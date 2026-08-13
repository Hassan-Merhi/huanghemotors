import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html','eagle.html','super.html','dealership.html','motorcycle.html',
  'assets/styles.css','assets/wave2.css','assets/wave3.css','assets/app.js','assets/cms.js','assets/logo.svg','assets/logo-mark.svg',
  'admin/index.html','admin/admin.css','admin/admin.js','worker/index.js','migrations/0001_admin_content.sql','wrangler.example.jsonc','ADMIN_SETUP.md'
];
const errors = [];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing ${rel}`);

const pages = ['index.html','eagle.html','super.html','dealership.html','motorcycle.html'];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  for (const token of ['Huanghe Motors','Lubumbashi','data-lang="en"','data-lang="fr"','assets/logo.svg','assets/app.js']) {
    if (!html.includes(token)) errors.push(`${page} missing ${token}`);
  }
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${page} has a duplicate HTML id`);
}

const adminHtml = fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
for (const token of ['data-login-form','data-model-list','data-upload','data-media-grid','data-save','admin.js']) if (!adminHtml.includes(token)) errors.push(`admin/index.html missing ${token}`);

const adminJs = fs.readFileSync(path.join(root,'admin/admin.js'),'utf8');
for (const token of ['/api/admin/login','/api/admin/models','/images/order','dataBase64','Set main']) if (!adminJs.includes(token)) errors.push(`admin/admin.js missing ${token}`);

const worker = fs.readFileSync(path.join(root,'worker/index.js'),'utf8');
for (const token of ['ADMIN_PASSWORD_SHA256','SESSION_SECRET','crypto.subtle.timingSafeEqual','env.DB.prepare','env.MEDIA.put','env.MEDIA.delete','HttpOnly','SameSite=Strict','MAX=6*1024*1024','HTMLRewriter','/assets/cms.js','/assets/wave3.css']) if (!worker.includes(token)) errors.push(`worker/index.js missing ${token}`);
for (const forbidden of ['ADMIN_PASSWORD =','password123','changeme']) if (worker.toLowerCase().includes(forbidden.toLowerCase())) errors.push(`worker/index.js contains forbidden secret pattern ${forbidden}`);

const migration = fs.readFileSync(path.join(root,'migrations/0001_admin_content.sql'),'utf8');
for (const token of ['CREATE TABLE IF NOT EXISTS models','CREATE TABLE IF NOT EXISTS model_images','CREATE TABLE IF NOT EXISTS admin_audit',"('eagle'","('super'"]) if (!migration.includes(token)) errors.push(`migration missing ${token}`);

const cms = fs.readFileSync(path.join(root,'assets/cms.js'),'utf8');
for (const token of ['/api/public/models','cms-gallery','motorcycle.html?model=','hydrateProduct']) if (!cms.includes(token)) errors.push(`assets/cms.js missing ${token}`);

const generic = fs.readFileSync(path.join(root,'motorcycle.html'),'utf8');
for (const token of ['data-page="motorcycle"','assets/cms.js','assets/wave3.css','specifications']) if (!generic.includes(token)) errors.push(`motorcycle.html missing ${token}`);

const localHrefs = [];
for (const page of [...pages, 'admin/index.html']) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = path.resolve(root, path.dirname(page), clean);
    if (!fs.existsSync(target)) localHrefs.push(`${page} -> ${clean}`);
  }
}
if (localHrefs.length) errors.push(`Broken local links:\n${localHrefs.join('\n')}`);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Wave 3 verification passed: admin authentication, motorcycle CMS, D1/R2 media backend, EN/FR editing and public hydration are present.');
