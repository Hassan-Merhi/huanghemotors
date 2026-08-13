import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['index.html','assets/styles.css','assets/app.js','assets/logo.svg','assets/logo-mark.svg'];
const errors = [];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing ${rel}`);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const js = fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
for (const token of ['Eagle','Super','Lubumbashi','data-lang="en"','data-lang="fr"','assets/logo.svg']) if (!html.includes(token)) errors.push(`index.html missing ${token}`);
for (const token of ['const translations','en:','fr:','localStorage']) if (!js.includes(token)) errors.push(`app.js missing ${token}`);
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) errors.push('Duplicate HTML id found');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Wave 1 verification passed: branding, responsive shell, bilingual foundation, Eagle/Super catalogue and local assets are present.');
