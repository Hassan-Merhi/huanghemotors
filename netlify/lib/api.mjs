import { getStore } from '@netlify/blobs';
import { query, one, exec, database } from './db.mjs';
import { clearSessionCookie, makeSessionCookie, sessionFromRequest, verifyPassword } from './auth.mjs';
import { digits, json, numberOrNull, randomId, readJson, sha256, text } from './common.mjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_IMAGE = 4 * 1024 * 1024;
const LEAD_WINDOW = 3600;
const LEAD_LIMIT = 5;
const LEAD_MAX = 200;

function mediaStore() { return getStore('huanghe-motors-media'); }
function bool(value) { return value === true || value === 1 || value === '1'; }

export async function handleApi(request, context) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/api/admin/login' && method === 'POST') return login(request);
    if (path === '/api/admin/logout' && method === 'POST') return logout();
    if (path === '/api/admin/session' && method === 'GET') {
      const session = sessionFromRequest(request);
      return session ? json({ authenticated: true, expiresAt: session.exp }) : json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/api/public/models' && method === 'GET') return listModels(true);
    const publicModel = path.match(/^\/api\/public\/models\/([a-z0-9-]+)$/);
    if (publicModel && method === 'GET') return getModel(publicModel[1], true);
    if (path === '/api/public/contact-settings' && method === 'GET') return publicSettings();
    if (path === '/api/public/stock' && method === 'GET') return publicStock();
    if (path === '/api/public/leads' && method === 'POST') return createLead(request, context);

    if (!path.startsWith('/api/admin/')) return json({ error: 'Not found' }, 404);
    if (!sessionFromRequest(request)) return json({ error: 'Unauthorized' }, 401);

    if (path === '/api/admin/models' && method === 'GET') return listModels(false);
    if (path === '/api/admin/models' && method === 'POST') return saveModel(request, null);
    const adminModel = path.match(/^\/api\/admin\/models\/([a-z0-9-]+)$/);
    if (adminModel && method === 'PUT') return saveModel(request, adminModel[1]);
    if (adminModel && method === 'DELETE') return deleteModel(adminModel[1]);
    const modelImages = path.match(/^\/api\/admin\/models\/([a-z0-9-]+)\/images$/);
    if (modelImages && method === 'POST') return uploadImage(request, modelImages[1]);
    const modelOrder = path.match(/^\/api\/admin\/models\/([a-z0-9-]+)\/images\/order$/);
    if (modelOrder && method === 'PATCH') return reorderImages(request, modelOrder[1]);
    const image = path.match(/^\/api\/admin\/images\/([a-f0-9-]+)$/);
    if (image && method === 'PATCH') return editImage(request, image[1]);
    if (image && method === 'DELETE') return deleteImage(image[1]);

    if (path === '/api/admin/leads' && method === 'GET') return listLeads(url);
    const lead = path.match(/^\/api\/admin\/leads\/([a-f0-9-]+)$/);
    if (lead && method === 'PATCH') return updateLead(request, lead[1]);
    if (path === '/api/admin/settings' && method === 'GET') return adminSettings();
    if (path === '/api/admin/settings' && method === 'PUT') return saveSettings(request);
    if (path === '/api/admin/mototrack' && method === 'GET') return integrationState();
    if (path === '/api/admin/mototrack' && method === 'PUT') return saveMappings(request);
    if (path === '/api/admin/mototrack/sync' && method === 'POST') return runMotoTrackSync(true);

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(JSON.stringify({ event: 'netlify_api_error', message: error instanceof Error ? error.message : String(error) }));
    return json({ error: error?.message === 'Request body too large' ? error.message : 'Internal server error' }, error?.message === 'Request body too large' ? 413 : 500);
  }
}

async function login(request) {
  if (!process.env.ADMIN_PASSWORD_SHA256 || !process.env.SESSION_SECRET) return json({ error: 'Admin secrets are not configured' }, 503);
  const body = await readJson(request, 4096);
  if (!verifyPassword(body.password)) return json({ error: 'Invalid password' }, 401);
  const { exp, cookie } = makeSessionCookie();
  return new Response(JSON.stringify({ authenticated: true, expiresAt: exp }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': cookie },
  });
}

function logout() {
  return new Response('{"authenticated":false}', {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': clearSessionCookie() },
  });
}

async function listModels(publicOnly) {
  const rows = await query(`SELECT slug,name,description_en,description_fr,availability,published,spec_engine,spec_transmission,spec_brakes,spec_fuel,spec_colors,spec_price,sort_order,public_quantity,stock_source,stock_updated_at FROM models ${publicOnly ? 'WHERE published=1 ' : ''}ORDER BY sort_order,name`);
  const models = await attachImages(rows);
  return json({ models }, 200, publicOnly ? { 'cache-control': 'public,max-age=60' } : {});
}

async function getModel(slug, publicOnly = false, status = 200) {
  const model = await one(`SELECT slug,name,description_en,description_fr,availability,published,spec_engine,spec_transmission,spec_brakes,spec_fuel,spec_colors,spec_price,sort_order,public_quantity,stock_source,stock_updated_at FROM models WHERE slug=$1${publicOnly ? ' AND published=1' : ''}`, [slug]);
  if (!model) return json({ error: 'Not found' }, 404);
  const [hydrated] = await attachImages([model]);
  return json({ model: hydrated }, status, publicOnly ? { 'cache-control': 'public,max-age=60' } : {});
}

async function attachImages(rows) {
  const output = [];
  for (const row of rows) {
    const images = await query('SELECT id,object_key,content_type,alt_en,alt_fr,sort_order,is_primary FROM model_images WHERE model_slug=$1 ORDER BY is_primary DESC,sort_order,created_at', [row.slug]);
    output.push({
      ...row,
      published: bool(row.published),
      images: images.map((img) => ({ ...img, is_primary: bool(img.is_primary), url: `/media/${img.object_key}` })),
    });
  }
  return output;
}

function cleanModel(input, slug = '') {
  const allowedAvailability = new Set(['in_stock', 'low_stock', 'out_of_stock', 'coming_soon', 'inquire']);
  return {
    slug: slug || String(input.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60),
    name: text(input.name, 80),
    description_en: text(input.description_en, 1200),
    description_fr: text(input.description_fr, 1200),
    availability: allowedAvailability.has(input.availability) ? input.availability : 'inquire',
    published: input.published !== false ? 1 : 0,
    spec_engine: text(input.spec_engine, 160),
    spec_transmission: text(input.spec_transmission, 160),
    spec_brakes: text(input.spec_brakes, 160),
    spec_fuel: text(input.spec_fuel, 160),
    spec_colors: text(input.spec_colors, 240),
    spec_price: text(input.spec_price, 160),
    sort_order: Number.isFinite(Number(input.sort_order)) ? Math.max(0, Math.min(9999, Math.trunc(Number(input.sort_order)))) : 100,
  };
}

async function saveModel(request, slug) {
  const input = cleanModel(await readJson(request, 32768), slug || '');
  if (!input.slug || !input.name) return json({ error: 'Slug and name are required' }, 400);
  if (!slug) {
    if (await one('SELECT slug FROM models WHERE slug=$1', [input.slug])) return json({ error: 'A model with this slug already exists' }, 409);
    await exec(`INSERT INTO models(slug,name,description_en,description_fr,availability,published,spec_engine,spec_transmission,spec_brakes,spec_fuel,spec_colors,spec_price,sort_order,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`, [input.slug,input.name,input.description_en,input.description_fr,input.availability,input.published,input.spec_engine,input.spec_transmission,input.spec_brakes,input.spec_fuel,input.spec_colors,input.spec_price,input.sort_order]);
    await audit('model.create', input.slug, input.name);
    return getModel(input.slug, false, 201);
  }
  if (!await one('SELECT slug FROM models WHERE slug=$1', [slug])) return json({ error: 'Model not found' }, 404);
  await exec(`UPDATE models SET name=$1,description_en=$2,description_fr=$3,availability=$4,published=$5,spec_engine=$6,spec_transmission=$7,spec_brakes=$8,spec_fuel=$9,spec_colors=$10,spec_price=$11,sort_order=$12,updated_at=NOW() WHERE slug=$13`, [input.name,input.description_en,input.description_fr,input.availability,input.published,input.spec_engine,input.spec_transmission,input.spec_brakes,input.spec_fuel,input.spec_colors,input.spec_price,input.sort_order,slug]);
  await audit('model.update', slug, input.name);
  return getModel(slug);
}

async function deleteModel(slug) {
  if (['eagle', 'super'].includes(slug)) return json({ error: 'Core models cannot be deleted; unpublish them instead' }, 400);
  const existing = await one('SELECT slug FROM models WHERE slug=$1', [slug]);
  if (!existing) return json({ error: 'Model not found' }, 404);
  const images = await query('SELECT object_key FROM model_images WHERE model_slug=$1', [slug]);
  const store = mediaStore();
  for (const image of images) await store.delete(image.object_key);
  await exec('DELETE FROM models WHERE slug=$1', [slug]);
  await audit('model.delete', slug, '');
  return json({ deleted: true });
}

async function uploadImage(request, slug) {
  if (!await one('SELECT slug FROM models WHERE slug=$1', [slug])) return json({ error: 'Model not found' }, 404);
  const contentType = request.headers.get('content-type') || '';
  let file, altEn = '', altFr = '';
  if (contentType.includes('application/json')) {
    const body = await readJson(request, 5_900_000);
    const type = String(body.type || '');
    let bytes;
    try { bytes = Buffer.from(String(body.dataBase64 || ''), 'base64'); } catch { bytes = Buffer.alloc(0); }
    file = new Blob([bytes], { type });
    altEn = text(body.alt_en, 180);
    altFr = text(body.alt_fr, 180);
  } else {
    const form = await request.formData();
    file = form.get('file');
    altEn = text(form.get('alt_en'), 180);
    altFr = text(form.get('alt_fr'), 180);
  }
  if (!(file instanceof Blob)) return json({ error: 'Image file is required' }, 400);
  if (!IMAGE_TYPES.has(file.type)) return json({ error: 'Use JPEG, PNG, WebP or AVIF images' }, 400);
  if (!file.size || file.size > MAX_IMAGE) return json({ error: 'On Netlify, images must be 4 MB or smaller' }, 413);
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const id = randomId();
  const key = `${slug}/${id}.${ext}`;
  const countRow = await one('SELECT COUNT(*)::int count FROM model_images WHERE model_slug=$1', [slug]);
  const sort = Number(countRow?.count || 0);
  await mediaStore().set(key, file, { metadata: { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' } });
  try {
    await exec('INSERT INTO model_images(id,model_slug,object_key,content_type,alt_en,alt_fr,sort_order,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, slug, key, file.type, altEn, altFr, sort, sort === 0 ? 1 : 0]);
  } catch (error) {
    await mediaStore().delete(key);
    throw error;
  }
  await audit('image.upload', slug, key);
  return getModel(slug, false, 201);
}

async function editImage(request, id) {
  const image = await one('SELECT id,model_slug FROM model_images WHERE id=$1', [id]);
  if (!image) return json({ error: 'Image not found' }, 404);
  const body = await readJson(request, 8192);
  if (body.is_primary) {
    const client = await database().pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE model_images SET is_primary=0 WHERE model_slug=$1', [image.model_slug]);
      await client.query('UPDATE model_images SET is_primary=1,alt_en=$1,alt_fr=$2 WHERE id=$3', [text(body.alt_en,180),text(body.alt_fr,180),id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } else {
    await exec('UPDATE model_images SET alt_en=$1,alt_fr=$2 WHERE id=$3', [text(body.alt_en,180), text(body.alt_fr,180), id]);
  }
  await audit('image.update', image.model_slug, id);
  return getModel(image.model_slug);
}

async function reorderImages(request, slug) {
  const body = await readJson(request, 32768);
  const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string').slice(0, 100) : [];
  if (!ids.length) return json({ error: 'Image order is required' }, 400);
  const client = await database().pool.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < ids.length; index += 1) {
      await client.query('UPDATE model_images SET sort_order=$1 WHERE id=$2 AND model_slug=$3', [index, ids[index], slug]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await audit('image.reorder', slug, ids.join(','));
  return getModel(slug);
}

async function deleteImage(id) {
  const image = await one('SELECT id,model_slug,object_key,is_primary FROM model_images WHERE id=$1', [id]);
  if (!image) return json({ error: 'Image not found' }, 404);
  await mediaStore().delete(image.object_key);
  await exec('DELETE FROM model_images WHERE id=$1', [id]);
  if (bool(image.is_primary)) {
    const next = await one('SELECT id FROM model_images WHERE model_slug=$1 ORDER BY sort_order,created_at LIMIT 1', [image.model_slug]);
    if (next) await exec('UPDATE model_images SET is_primary=1 WHERE id=$1', [next.id]);
  }
  await audit('image.delete', image.model_slug, image.object_key);
  return getModel(image.model_slug);
}

async function publicSettings() {
  const rows = await query("SELECT key,value FROM site_settings WHERE key IN ('whatsapp_number','show_public_quantity')");
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return json({ whatsapp_number: digits(settings.whatsapp_number), show_public_quantity: settings.show_public_quantity === '1' }, 200, { 'cache-control': 'public,max-age=60' });
}

async function publicStock() {
  const setting = await one("SELECT value FROM site_settings WHERE key='show_public_quantity'");
  const show = setting?.value === '1';
  const rows = await query('SELECT slug,availability,public_quantity,stock_source,stock_updated_at FROM models WHERE published=1 ORDER BY sort_order,name');
  return json({ models: rows.map((row) => ({ slug: row.slug, availability: row.availability, quantity: show ? row.public_quantity : null, stock_source: row.stock_source, stock_updated_at: row.stock_updated_at })) }, 200, { 'cache-control': 'public,max-age=45' });
}

async function createLead(request, context) {
  const body = await readJson(request, 16384);
  if (String(body.website || '')) return json({ ok: true }, 201);
  const name = text(body.name, 100), phone = text(body.phone, 50), email = text(body.email, 160), city = text(body.city, 100), message = text(body.message, 1500);
  const language = body.language === 'fr' ? 'fr' : 'en';
  const modelSlug = text(body.model_slug, 60).toLowerCase();
  if (name.length < 2 || phone.length < 5) return json({ error: 'Name and phone are required' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
  const started = Number(body.started_at || 0);
  if (started && Date.now() - started < 1500) return json({ error: 'Please try again' }, 429);
  if (!await allowLead(request, context)) return json({ error: 'Too many inquiries. Please try again later.' }, 429);
  const existing = modelSlug ? await one('SELECT slug FROM models WHERE slug=$1 AND published=1', [modelSlug]) : null;
  const id = randomId();
  await exec('INSERT INTO leads(id,model_slug,language,name,phone,email,city,message,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, existing?.slug || null, language, name, phone, email, city, message, 'website']);
  return json({ ok: true, id }, 201);
}

async function allowLead(request, context) {
  const ip = context?.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const salt = process.env.LEAD_RATE_SALT || process.env.SESSION_SECRET || 'huanghe-public';
  const identity = sha256(`${salt}:${ip}`);
  const now = Math.floor(Date.now() / 1000);
  const row = await one('SELECT window_started_at,attempts FROM lead_rate_limits WHERE identity_hash=$1', [identity]);
  if (!row || now - Number(row.window_started_at) >= LEAD_WINDOW) {
    await exec('INSERT INTO lead_rate_limits(identity_hash,window_started_at,attempts) VALUES($1,$2,1) ON CONFLICT(identity_hash) DO UPDATE SET window_started_at=EXCLUDED.window_started_at,attempts=1', [identity, now]);
    return true;
  }
  if (Number(row.attempts) >= LEAD_LIMIT) return false;
  await exec('UPDATE lead_rate_limits SET attempts=attempts+1 WHERE identity_hash=$1', [identity]);
  return true;
}

async function listLeads(url) {
  const status = text(url.searchParams.get('status'), 20), model = text(url.searchParams.get('model'), 60);
  const limit = Math.min(LEAD_MAX, Math.max(1, Number(url.searchParams.get('limit') || 100)));
  let sql = 'SELECT id,model_slug,language,name,phone,email,city,message,source,status,created_at,updated_at FROM leads WHERE 1=1';
  const params = [];
  if (status) { params.push(status); sql += ` AND status=$${params.length}`; }
  if (model) { params.push(model); sql += ` AND model_slug=$${params.length}`; }
  params.push(limit); sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  return json({ leads: await query(sql, params) });
}

async function updateLead(request, id) {
  const body = await readJson(request, 4096);
  const allowed = new Set(['new', 'contacted', 'qualified', 'closed', 'spam']);
  if (!allowed.has(body.status)) return json({ error: 'Invalid status' }, 400);
  const updated = await query('UPDATE leads SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id', [body.status, id]);
  if (!updated.length) return json({ error: 'Lead not found' }, 404);
  await audit('lead.status', null, `${id}:${body.status}`);
  return json({ ok: true });
}

async function adminSettings() {
  const rows = await query('SELECT key,value,updated_at FROM site_settings ORDER BY key');
  return json({ settings: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
}

async function saveSettings(request) {
  const body = await readJson(request, 8192);
  const whatsapp = digits(body.whatsapp_number).slice(0, 20);
  const show = body.show_public_quantity === true || body.show_public_quantity === '1' ? '1' : '0';
  await exec("INSERT INTO site_settings(key,value,updated_at) VALUES('whatsapp_number',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [whatsapp]);
  await exec("INSERT INTO site_settings(key,value,updated_at) VALUES('show_public_quantity',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [show]);
  await audit('settings.update', null, `whatsapp=${whatsapp ? 'set' : 'empty'},show_qty=${show}`);
  return adminSettings();
}

async function integrationState() {
  const models = await query('SELECT m.slug,m.name,mm.external_key,mm.enabled,m.availability,m.public_quantity,m.stock_updated_at FROM models m LEFT JOIN mototrack_mapping mm ON mm.model_slug=m.slug ORDER BY m.sort_order,m.name');
  const last = await one('SELECT status,records_seen,records_updated,detail,created_at FROM mototrack_sync_log ORDER BY created_at DESC LIMIT 1');
  return json({ configured: Boolean(process.env.MOTOTRACK_URL), models: models.map((row) => ({ ...row, enabled: row.enabled !== 0 && row.enabled !== false })), last_sync: last || null });
}

async function saveMappings(request) {
  const body = await readJson(request, 32768);
  const rows = Array.isArray(body.models) ? body.models.slice(0, 200) : [];
  if (!rows.length) return json({ error: 'Mappings are required' }, 400);
  let saved = 0;
  for (const row of rows) {
    const slug = text(row.slug, 60), external = text(row.external_key, 160);
    if (!slug) continue;
    await exec('INSERT INTO mototrack_mapping(model_slug,external_key,enabled,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(model_slug) DO UPDATE SET external_key=EXCLUDED.external_key,enabled=EXCLUDED.enabled,updated_at=NOW()', [slug, external, row.enabled === false ? 0 : 1]);
    saved += 1;
  }
  await audit('mototrack.mapping', null, `${saved} mappings`);
  return integrationState();
}

export async function runMotoTrackSync(manual = false) {
  if (!process.env.MOTOTRACK_URL) return manual ? json({ error: 'MOTOTRACK_URL is not configured' }, 503) : { skipped: true };
  const headers = { accept: 'application/json' };
  if (process.env.MOTOTRACK_TOKEN) headers.authorization = `Bearer ${process.env.MOTOTRACK_TOKEN}`;
  let response;
  try {
    response = await fetch(process.env.MOTOTRACK_URL, { headers, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    return logSync('error', 0, 0, error?.message || 'Fetch failed', manual, 502);
  }
  if (!response.ok) return logSync('error', 0, 0, `HTTP ${response.status}`, manual, 502);
  const payload = await response.json();
  const sourceRows = normalizeMotoTrackPayload(payload);
  const mappings = await query('SELECT model_slug,external_key FROM mototrack_mapping WHERE enabled=1');
  let updated = 0;
  for (const mapping of mappings) {
    const key = String(mapping.external_key || mapping.model_slug).toLowerCase();
    const source = sourceRows.find((row) => row.key === key);
    if (!source) continue;
    const quantity = numberOrNull(source.quantity);
    const status = stockAvailability(source, quantity);
    await exec("UPDATE models SET availability=$1,public_quantity=$2,stock_source='mototrack',stock_updated_at=NOW(),updated_at=NOW() WHERE slug=$3", [status, quantity, mapping.model_slug]);
    updated += 1;
  }
  return logSync('success', sourceRows.length, updated, `Synced ${updated} public model records`, manual, 200);
}

export function normalizeMotoTrackPayload(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.inventory) ? payload.inventory : Array.isArray(payload?.stock) ? payload.stock : Array.isArray(payload?.models) ? payload.models : Array.isArray(payload?.data) ? payload.data : [];
  return list.map((item) => ({
    key: String(item.slug ?? item.model_slug ?? item.model ?? item.code ?? item.id ?? item.name ?? '').trim().toLowerCase(),
    quantity: item.public_quantity ?? item.quantity ?? item.qty ?? item.stock ?? item.available_quantity ?? null,
    availability: item.availability ?? item.status ?? '',
  })).filter((item) => item.key);
}

function stockAvailability(row, quantity) {
  const explicit = String(row.availability || '').toLowerCase();
  if (['in_stock','low_stock','out_of_stock','coming_soon','inquire'].includes(explicit)) return explicit;
  if (quantity === null) return 'inquire';
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= 3) return 'low_stock';
  return 'in_stock';
}

async function logSync(status, seen, updated, detail, manual, httpStatus) {
  await exec('INSERT INTO mototrack_sync_log(id,status,records_seen,records_updated,detail) VALUES($1,$2,$3,$4,$5)', [randomId(), status, seen, updated, text(detail, 1000)]);
  if (status === 'success') await audit('mototrack.sync', null, detail);
  const result = { ok: status === 'success', status, records_seen: seen, records_updated: updated, detail };
  return manual ? json(result, httpStatus) : result;
}

async function audit(action, slug, detail) {
  await exec('INSERT INTO admin_audit(id,action,model_slug,detail) VALUES($1,$2,$3,$4)', [randomId(), action, slug || null, text(detail, 1000)]);
}
