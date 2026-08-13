import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html','eagle.html','super.html','dealership.html',
  'assets/styles.css','assets/wave2.css','assets/app.js','assets/logo.svg','assets/logo-mark.svg'
];
const errors = [];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing ${rel}`);

const pages = ['index.html','eagle.html','super.html','dealership.html'];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  for (const token of ['Huanghe Motors','Lubumbashi','data-lang="en"','data-lang="fr"','assets/logo.svg','assets/app.js']) {
    if (!html.includes(token)) errors.push(`${page} missing ${token}`);
  }
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${page} has a duplicate HTML id`);
}

const index = fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const token of ['eagle.html','super.html','dealership.html']) if (!index.includes(token)) errors.push(`index.html missing link ${token}`);

for (const [page, token] of [['eagle.html','Eagle'],['super.html','Super'],['dealership.html','dealerPage.visitTitle']]) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  if (!html.includes(token)) errors.push(`${page} missing Wave 2 content token ${token}`);
}

const js = fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
for (const token of ['const translations','en:','fr:','const pageMeta','eagle:','super:','dealership:','localStorage']) if (!js.includes(token)) errors.push(`app.js missing ${token}`);

const localHrefs = [];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root,page),'utf8');
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
    const target = href.split('#')[0];
    if (target && !fs.existsSync(path.join(root,target))) localHrefs.push(`${page} -> ${target}`);
  }
}
if (localHrefs.length) errors.push(`Broken local links:\n${localHrefs.join('\n')}`);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Wave 2 verification passed: Eagle/Super product pages, EN/FR content, Lubumbashi dealer page, navigation and local assets are present.');
