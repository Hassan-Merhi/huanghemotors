import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=['worker/entry.js','worker/wave4.js','migrations/0002_wave4.sql','assets/wave4.js','assets/wave4.css','admin/operations.html','admin/operations.js','admin/operations.css','WAVE4_SETUP.md','wrangler.example.jsonc'];
const errors=[];for(const f of required)if(!fs.existsSync(path.join(root,f)))errors.push(`Missing ${f}`);
function read(f){return fs.readFileSync(path.join(root,f),'utf8')}
const worker=read('worker/wave4.js');for(const t of ['/api/public/leads','/api/public/stock','/api/admin/leads','/api/admin/mototrack/sync','MOTOTRACK_URL','MOTOTRACK_TOKEN','public_quantity','timingSafeEqual'])if(!worker.includes(t))errors.push(`wave4 worker missing ${t}`);
const migration=read('migrations/0002_wave4.sql');for(const t of ['CREATE TABLE IF NOT EXISTS leads','CREATE TABLE IF NOT EXISTS mototrack_mapping','CREATE TABLE IF NOT EXISTS mototrack_sync_log','public_quantity'])if(!migration.includes(t))errors.push(`migration missing ${t}`);
const publicJs=read('assets/wave4.js');for(const t of ['/api/public/leads','/api/public/contact-settings','https://wa.me/','Request price','Demander le prix'])if(!publicJs.includes(t))errors.push(`public Wave 4 JS missing ${t}`);
const ops=read('admin/operations.js');for(const t of ['/api/admin/leads','/api/admin/settings','/api/admin/mototrack','/api/admin/mototrack/sync'])if(!ops.includes(t))errors.push(`operations admin missing ${t}`);
const wrangler=read('wrangler.example.jsonc');if(!wrangler.includes('worker/entry.js'))errors.push('Wrangler is not pointed at Wave 4 entry');if(!wrangler.includes('*/15 * * * *'))errors.push('Wrangler is missing Moto Track cron');
const {normalizeMotoTrackPayload}=await import(pathToFileURL(path.join(root,'worker/wave4.js')));
const a=normalizeMotoTrackPayload({inventory:[{slug:'Eagle',qty:5},{model_slug:'super',quantity:0}]});if(a.length!==2||a[0].key!=='eagle'||a[0].quantity!==5||a[1].key!=='super')errors.push('Moto Track normalization failed inventory shape');
const b=normalizeMotoTrackPayload({data:[{code:'HH-1',stock:3}]});if(b.length!==1||b[0].key!=='hh-1'||b[0].quantity!==3)errors.push('Moto Track normalization failed data shape');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log('Wave 4 verification passed: leads, WhatsApp, public stock adapter, Moto Track mapping/sync, admin operations and deployment config are present.');
