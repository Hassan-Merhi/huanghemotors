import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const edge = read('netlify/edge-functions/site-middleware.mjs');
if (!edge.includes('[hidden]{display:none!important}')) errors.push('Admin HTML must enforce the hidden attribute in CSS.');
if (!edge.includes("url.pathname.startsWith('/admin/')")) errors.push('Hidden-state guard must be scoped to admin pages.');

const contentHtml = read('admin/content.html');
if (!contentHtml.includes('data-content-dashboard hidden')) errors.push('Website Content dashboard must start hidden.');

const contentJs = read('admin/content.js');
if (!contentJs.includes("request('/api/admin/session')")) errors.push('Website Content must verify the admin session before revealing UI.');
if (!contentJs.includes("location.replace('index.html')")) errors.push('Unauthorized Website Content visits must return to the admin login.');
if (!contentJs.includes("$('[data-content-dashboard]').hidden=false")) errors.push('Website Content may only reveal the dashboard after the session check succeeds.');

const indexHtml = read('admin/index.html');
if (!indexHtml.includes('data-dashboard hidden')) errors.push('Main admin dashboard must start hidden.');

const operationsHtml = read('admin/operations.html');
if (!operationsHtml.includes('data-ops hidden')) errors.push('Operations dashboard must start hidden.');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Admin auth gating verification passed: unauthenticated admin dashboards stay hidden until a valid session is confirmed.');
