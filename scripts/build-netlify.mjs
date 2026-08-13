import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const files = ['index.html','eagle.html','super.html','dealership.html','motorcycle.html','404.html','site.webmanifest'];
const dirs = ['assets','admin'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of files) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, file));
}
for (const dir of dirs) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(out, dir), { recursive: true });
}
console.log('Netlify static bundle created in dist/');
