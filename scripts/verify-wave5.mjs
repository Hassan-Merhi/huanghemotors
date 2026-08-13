import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const required = [
  '.assetsignore','404.html','site.webmanifest','worker/seo.js','tests/seo.test.mjs','WAVE5_DEPLOYMENT.md'
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`);

const entry = fs.readFileSync(path.join(root, 'worker/entry.js'), 'utf8');
for (const token of ["from './seo.js'", 'handleSeoRoute', 'applySeo']) {
  if (!entry.includes(token)) errors.push(`worker/entry.js missing ${token}`);
}

const seo = fs.readFileSync(path.join(root, 'worker/seo.js'), 'utf8');
for (const token of ['/robots.txt','/sitemap.xml','rel="canonical"','application/ld+json','Organization','x-content-type-options','x-frame-options','permissions-policy','x-robots-tag']) {
  if (!seo.includes(token)) errors.push(`worker/seo.js missing ${token}`);
}
for (const forbidden of ['LocalBusiness', 'streetAddress:', 'telephone:']) {
  if (seo.includes(forbidden)) errors.push(`worker/seo.js should not publish unconfirmed local-business detail: ${forbidden}`);
}

const ignore = fs.readFileSync(path.join(root, '.assetsignore'), 'utf8');
for (const token of ['worker','migrations','scripts','tests','*.md','wrangler*.jsonc']) {
  if (!ignore.split(/\r?\n/).includes(token)) errors.push(`.assetsignore must exclude ${token}`);
}

const wrangler = fs.readFileSync(path.join(root, 'wrangler.example.jsonc'), 'utf8');
for (const token of ['"run_worker_first": true','"not_found_handling": "404-page"','"main": "worker/entry.js"','"*/15 * * * *"']) {
  if (!wrangler.includes(token)) errors.push(`wrangler.example.jsonc missing ${token}`);
}
if (wrangler.includes('single-page-application')) errors.push('Production config must not turn unknown URLs into 200 SPA responses');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8'));
if (manifest.name !== 'Huanghe Motors Lubumbashi') errors.push('Manifest name mismatch');
if (manifest.start_url !== '/') errors.push('Manifest start_url must be root');

const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
if (!notFound.includes('noindex,nofollow')) errors.push('404 page must be noindex');
if (!notFound.includes('<h1')) errors.push('404 page needs an h1');

const publicPages = ['index.html','eagle.html','super.html','dealership.html','motorcycle.html'];
for (const file of publicPages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) errors.push(`${file} needs a source description fallback`);
  const h1 = (html.match(/<h1\b/gi) || []).length;
  if (h1 !== 1) errors.push(`${file} should contain exactly one h1, found ${h1}`);
}

const adminPages = ['admin/index.html','admin/operations.html'];
for (const file of adminPages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/name="robots"[^>]+noindex/i.test(html)) errors.push(`${file} must declare noindex`);
}

const allTextFiles = ['worker/index.js','worker/entry.js','worker/wave4.js','worker/seo.js','wrangler.example.jsonc','WAVE4_SETUP.md','WAVE5_DEPLOYMENT.md'];
for (const file of allTextFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const secretPattern of ['password123','changeme','sk_live_','Bearer eyJ']) {
    if (text.toLowerCase().includes(secretPattern.toLowerCase())) errors.push(`${file} contains forbidden secret-like text ${secretPattern}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Wave 5 verification passed: crawl/index controls, runtime canonicals, sitemap/robots, deployment asset boundary, 404 behavior and security headers are production-ready.');
