import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const required = [
  'netlify.toml',
  'netlify/functions/api.mjs',
  'netlify/functions/media.mjs',
  'netlify/functions/robots.mjs',
  'netlify/functions/sitemap.mjs',
  'netlify/functions/mototrack-sync.mjs',
  'netlify/edge-functions/site-middleware.mjs',
  'netlify/lib/api.mjs',
  'netlify/lib/auth.mjs',
  'netlify/lib/db.mjs',
  'netlify/lib/seo.mjs',
  'netlify/database/migrations/20260813113000_huanghe_baseline.sql',
  'scripts/build-netlify.mjs',
  'NETLIFY_DEPLOYMENT.md',
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing ${rel}`);

const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
for (const token of ['publish = "dist"','directory = "netlify/functions"','function = "site-middleware"','path = "/*"']) {
  if (!config.includes(token)) errors.push(`netlify.toml missing ${token}`);
}
if (config.includes('worker/entry.js')) errors.push('Netlify config must not use Cloudflare Worker entrypoints');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const dep of ['@netlify/database','@netlify/blobs']) if (!pkg.dependencies?.[dep]) errors.push(`package.json missing ${dep}`);
if (!pkg.scripts?.build?.includes('build-netlify')) errors.push('package.json build must create the Netlify publish directory');

const api = fs.readFileSync(path.join(root, 'netlify/lib/api.mjs'), 'utf8');
for (const token of ['/api/public/models','ADMIN_PASSWORD_SHA256','SESSION_SECRET','LEAD_RATE_SALT','MOTOTRACK_URL','getStore(\'huanghe-motors-media\')','4 * 1024 * 1024']) {
  if (!api.includes(token)) errors.push(`Netlify API missing ${token}`);
}
for (const forbidden of ['env.DB','env.MEDIA','cf-connecting-ip']) if (api.includes(forbidden)) errors.push(`Netlify API still contains Cloudflare-only token ${forbidden}`);

const migration = fs.readFileSync(path.join(root, 'netlify/database/migrations/20260813113000_huanghe_baseline.sql'), 'utf8');
for (const token of ['CREATE TABLE IF NOT EXISTS models','CREATE TABLE IF NOT EXISTS leads','CREATE TABLE IF NOT EXISTS mototrack_mapping','TIMESTAMPTZ','ON CONFLICT']) {
  if (!migration.includes(token)) errors.push(`Netlify migration missing ${token}`);
}
if (migration.includes('PRAGMA')) errors.push('Postgres migration must not contain SQLite PRAGMA statements');

const edge = fs.readFileSync(path.join(root, 'netlify/edge-functions/site-middleware.mjs'), 'utf8');
for (const token of ['context.next()','transformHtml','noindex, nofollow, noarchive']) if (!edge.includes(token)) errors.push(`Edge middleware missing ${token}`);

const sync = fs.readFileSync(path.join(root, 'netlify/functions/mototrack-sync.mjs'), 'utf8');
if (!sync.includes("schedule: '*/15 * * * *'")) errors.push('Moto Track scheduled function must run every 15 minutes');

const build = fs.readFileSync(path.join(root, 'scripts/build-netlify.mjs'), 'utf8');
for (const token of ["const out = path.join(root, 'dist')", "const dirs = ['assets','admin']"]) if (!build.includes(token)) errors.push(`Netlify build script missing ${token}`);

for (const file of ['netlify/lib/auth.mjs','netlify/lib/api.mjs','NETLIFY_DEPLOYMENT.md']) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8').toLowerCase();
  for (const secret of ['password123','changeme','sk_live_','bearer eyj']) if (contents.includes(secret)) errors.push(`${file} contains secret-like placeholder ${secret}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Netlify verification passed: Functions, Database, Blobs, Edge SEO, scheduled Moto Track sync and safe publish directory are configured.');
