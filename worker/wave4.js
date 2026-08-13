const COOKIE='hm_admin', MAX_LEADS=200, LEAD_WINDOW=3600, LEAD_LIMIT=5;

export async function handleWave4(req, env, url) {
  const p=url.pathname, m=req.method;
  if (p==='/api/public/contact-settings' && m==='GET') return publicSettings(env);
  if (p==='/api/public/stock' && m==='GET') return publicStock(env);
  if (p==='/api/public/leads' && m==='POST') return createLead(req,env);
  if (!p.startsWith('/api/admin/')) return null;
  if (!['/api/admin/leads','/api/admin/settings','/api/admin/mototrack','/api/admin/mototrack/sync'].some(x=>p===x || p.startsWith(x+'/'))) return null;
  if (!await adminSession(req,env)) return json({error:'Unauthorized'},401);
  if (p==='/api/admin/leads' && m==='GET') return listLeads(env,url);
  const lm=p.match(/^\/api\/admin\/leads\/([a-f0-9-]+)$/);
  if (lm && m==='PATCH') return updateLead(req,env,lm[1]);
  if (p==='/api/admin/settings' && m==='GET') return adminSettings(env);
  if (p==='/api/admin/settings' && m==='PUT') return saveSettings(req,env);
  if (p==='/api/admin/mototrack' && m==='GET') return integrationState(env);
  if (p==='/api/admin/mototrack' && m==='PUT') return saveMappings(req,env);
  if (p==='/api/admin/mototrack/sync' && m==='POST') return runMotoTrackSync(env,true);
  return json({error:'Not found'},404);
}

export async function scheduledWave4(env) {
  if (!env.MOTOTRACK_URL) return;
  try { await runMotoTrackSync(env,false); }
  catch (error) { console.error(JSON.stringify({event:'mototrack_sync_error',message:String(error?.message||error)})); }
}

async function publicSettings(env){
  const r=await env.DB.prepare("SELECT key,value FROM site_settings WHERE key IN ('whatsapp_number','show_public_quantity')").all();
  const s=Object.fromEntries((r.results||[]).map(x=>[x.key,x.value]));
  return json({whatsapp_number:digits(s.whatsapp_number),show_public_quantity:s.show_public_quantity==='1'},200,{'cache-control':'public,max-age=60'});
}

async function publicStock(env){
  const setting=await env.DB.prepare("SELECT value FROM site_settings WHERE key='show_public_quantity'").first();
  const show=setting?.value==='1';
  const r=await env.DB.prepare('SELECT slug,availability,public_quantity,stock_source,stock_updated_at FROM models WHERE published=1 ORDER BY sort_order,name').all();
  return json({models:(r.results||[]).map(x=>({slug:x.slug,availability:x.availability,quantity:show?x.public_quantity:null,stock_source:x.stock_source,stock_updated_at:x.stock_updated_at}))},200,{'cache-control':'public,max-age=45'});
}

async function createLead(req,env){
  const x=await parseBody(req,16384);
  if (String(x.website||'')) return json({ok:true},201);
  const name=text(x.name,100), phone=text(x.phone,50), email=text(x.email,160), city=text(x.city,100), message=text(x.message,1500), lang=x.language==='fr'?'fr':'en', model=text(x.model_slug,60).toLowerCase();
  if (name.length<2 || phone.length<5) return json({error:'Name and phone are required'},400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Invalid email'},400);
  const started=Number(x.started_at||0); if (started && Date.now()-started<1500) return json({error:'Please try again'},429);
  if (!await allowLead(req,env)) return json({error:'Too many inquiries. Please try again later.'},429);
  const exists=model?await env.DB.prepare('SELECT slug FROM models WHERE slug=?1 AND published=1').bind(model).first():null;
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO leads(id,model_slug,language,name,phone,email,city,message,source) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)').bind(id,exists?.slug||null,lang,name,phone,email,city,message,'website').run();
  return json({ok:true,id},201);
}

async function allowLead(req,env){
  const ip=req.headers.get('cf-connecting-ip')||'unknown', salt=env.LEAD_RATE_SALT||env.SESSION_SECRET||'huanghe-public';
  const hash=await sha256(`${salt}:${ip}`), now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare('SELECT window_started_at,attempts FROM lead_rate_limits WHERE identity_hash=?1').bind(hash).first();
  if (!row || now-Number(row.window_started_at)>=LEAD_WINDOW) {
    await env.DB.prepare('INSERT INTO lead_rate_limits(identity_hash,window_started_at,attempts) VALUES(?1,?2,1) ON CONFLICT(identity_hash) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=1').bind(hash,now).run(); return true;
  }
  if (Number(row.attempts)>=LEAD_LIMIT) return false;
  await env.DB.prepare('UPDATE lead_rate_limits SET attempts=attempts+1 WHERE identity_hash=?1').bind(hash).run(); return true;
}

async function listLeads(env,url){
  const status=text(url.searchParams.get('status'),20), model=text(url.searchParams.get('model'),60), limit=Math.min(MAX_LEADS,Math.max(1,Number(url.searchParams.get('limit')||100)));
  let q='SELECT id,model_slug,language,name,phone,email,city,message,source,status,created_at,updated_at FROM leads WHERE 1=1', binds=[];
  if (status) { q+=` AND status=?${binds.length+1}`; binds.push(status); }
  if (model) { q+=` AND model_slug=?${binds.length+1}`; binds.push(model); }
  q+=` ORDER BY created_at DESC LIMIT ?${binds.length+1}`; binds.push(limit);
  const r=await env.DB.prepare(q).bind(...binds).all(); return json({leads:r.results||[]});
}
async function updateLead(req,env,id){
  const x=await parseBody(req,4096), allowed=new Set(['new','contacted','qualified','closed','spam']); if(!allowed.has(x.status)) return json({error:'Invalid status'},400);
  const r=await env.DB.prepare('UPDATE leads SET status=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(x.status,id).run(); if(!r.meta?.changes)return json({error:'Lead not found'},404);
  await audit(env,'lead.status',null,`${id}:${x.status}`); return json({ok:true});
}
async function adminSettings(env){ const r=await env.DB.prepare('SELECT key,value,updated_at FROM site_settings ORDER BY key').all(); return json({settings:Object.fromEntries((r.results||[]).map(x=>[x.key,x.value]))}); }
async function saveSettings(req,env){
  const x=await parseBody(req,8192), whatsapp=digits(x.whatsapp_number).slice(0,20), show=x.show_public_quantity===true||x.show_public_quantity==='1'?'1':'0';
  await env.DB.batch([
    env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES('whatsapp_number',?1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(whatsapp),
    env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES('show_public_quantity',?1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(show)
  ]); await audit(env,'settings.update',null,`whatsapp=${whatsapp?'set':'empty'},show_qty=${show}`); return adminSettings(env);
}
async function integrationState(env){
  const [maps,last]=await Promise.all([
    env.DB.prepare('SELECT m.slug,m.name,mm.external_key,mm.enabled,m.availability,m.public_quantity,m.stock_updated_at FROM models m LEFT JOIN mototrack_mapping mm ON mm.model_slug=m.slug ORDER BY m.sort_order,m.name').all(),
    env.DB.prepare('SELECT status,records_seen,records_updated,detail,created_at FROM mototrack_sync_log ORDER BY created_at DESC LIMIT 1').first()
  ]);
  return json({configured:Boolean(env.MOTOTRACK_URL),models:(maps.results||[]).map(x=>({...x,enabled:x.enabled!==0})),last_sync:last||null});
}
async function saveMappings(req,env){
  const x=await parseBody(req,32768), rows=Array.isArray(x.models)?x.models.slice(0,200):[]; if(!rows.length)return json({error:'Mappings are required'},400);
  const stmts=[]; for(const row of rows){const slug=text(row.slug,60), key=text(row.external_key,160);if(!slug)continue;stmts.push(env.DB.prepare('INSERT INTO mototrack_mapping(model_slug,external_key,enabled,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(model_slug) DO UPDATE SET external_key=excluded.external_key,enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP').bind(slug,key,row.enabled===false?0:1));}
  if(stmts.length)await env.DB.batch(stmts);await audit(env,'mototrack.mapping',null,`${stmts.length} mappings`);return integrationState(env);
}

async function runMotoTrackSync(env,manual){
  if(!env.MOTOTRACK_URL)return json({error:'MOTOTRACK_URL is not configured'},503);
  const headers={'accept':'application/json'}; if(env.MOTOTRACK_TOKEN)headers.authorization=`Bearer ${env.MOTOTRACK_TOKEN}`;
  const res=await fetch(env.MOTOTRACK_URL,{headers,signal:AbortSignal.timeout(15000)}); if(!res.ok) return logSync(env,'error',0,0,`HTTP ${res.status}`,manual,502);
  const payload=await res.json(); const rows=normalizeMotoTrackPayload(payload); const maps=await env.DB.prepare('SELECT model_slug,external_key FROM mototrack_mapping WHERE enabled=1').all();
  let updated=0; for(const map of maps.results||[]){const key=(map.external_key||map.model_slug).toLowerCase();const row=rows.find(r=>r.key===key);if(!row)continue;const q=numberOrNull(row.quantity), av=availability(row,q);await env.DB.prepare("UPDATE models SET availability=?1,public_quantity=?2,stock_source='mototrack',stock_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE slug=?3").bind(av,q,map.model_slug).run();updated++;}
  return logSync(env,'success',rows.length,updated,`Synced ${updated} public model records`,manual,200);
}
export function normalizeMotoTrackPayload(payload){const list=Array.isArray(payload)?payload:Array.isArray(payload?.inventory)?payload.inventory:Array.isArray(payload?.stock)?payload.stock:Array.isArray(payload?.models)?payload.models:Array.isArray(payload?.data)?payload.data:[];return list.map(x=>{const raw=x.slug??x.model_slug??x.model??x.code??x.id??x.name??'';return{key:String(raw).trim().toLowerCase(),quantity:x.public_quantity??x.quantity??x.qty??x.stock??x.available_quantity??null,availability:x.availability??x.status??''}}).filter(x=>x.key);}
function availability(row,q){const s=String(row.availability||'').toLowerCase();if(['in_stock','low_stock','out_of_stock','coming_soon','inquire'].includes(s))return s;if(q===null)return'inquire';if(q<=0)return'out_of_stock';if(q<=3)return'low_stock';return'in_stock';}
async function logSync(env,status,seen,updated,detail,manual,httpStatus){const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO mototrack_sync_log(id,status,records_seen,records_updated,detail) VALUES(?1,?2,?3,?4,?5)').bind(id,status,seen,updated,text(detail,1000)).run();if(status==='success')await audit(env,'mototrack.sync',null,detail);const out={ok:status==='success',status,records_seen:seen,records_updated:updated,detail};return manual?json(out,httpStatus):out;}

async function adminSession(req,env){const c=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='));if(!c||!env.SESSION_SECRET)return null;const parts=c.slice(COOKIE.length+1).split('.');if(parts.length!==2)return null;const [p,g]=parts,a=unb64(g),e=await mac(p,env.SESSION_SECRET);if(a.length!==e.length||!crypto.subtle.timingSafeEqual(a,e))return null;try{const o=JSON.parse(new TextDecoder().decode(unb64(p)));return Number.isInteger(o.exp)&&o.exp>Math.floor(Date.now()/1000)?o:null}catch{return null}}
async function mac(v,s){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(s),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(v)))}
async function audit(env,a,s,d){await env.DB.prepare('INSERT INTO admin_audit(id,action,model_slug,detail) VALUES(?1,?2,?3,?4)').bind(crypto.randomUUID(),a,s||null,text(d,1000)).run()}
async function parseBody(req,max){const n=Number(req.headers.get('content-length')||0);if(n>max)throw new Error('Request body too large');const t=await req.text();if(new TextEncoder().encode(t).byteLength>max)throw new Error('Request body too large');try{return JSON.parse(t||'{}')}catch{return{}}}
async function sha256(v){const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
function unb64(v){try{const s=atob(v.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(v.length/4)*4,'=')),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}catch{return new Uint8Array()}}
function digits(v){return String(v||'').replace(/\D/g,'')}
function text(v,n){return typeof v==='string'?v.trim().slice(0,n):''}
function numberOrNull(v){if(v===null||v===''||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):null}
function json(x,status=200,headers={}){return new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}})}
