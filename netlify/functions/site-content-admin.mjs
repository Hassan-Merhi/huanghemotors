import { sessionFromRequest } from '../lib/auth.mjs';
import { query, exec } from '../lib/db.mjs';
import { json, readJson, text } from '../lib/common.mjs';

async function payload() {
  const fields = await query('SELECT key,group_name,label,value_en,value_fr,input_type,sort_order,updated_at FROM site_content ORDER BY sort_order,key');
  return json({ fields });
}

export default async (request) => {
  if (!sessionFromRequest(request)) return json({ error: 'Unauthorized' }, 401);
  if (request.method === 'GET') return payload();
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const body = await readJson(request, 180000);
  const allowed = new Set((await query('SELECT key FROM site_content')).map((row) => row.key));
  for (const [key, value] of Object.entries(body.content || {})) {
    if (!allowed.has(key) || !value || typeof value !== 'object') continue;
    await exec('UPDATE site_content SET value_en=$1,value_fr=$2,updated_at=NOW() WHERE key=$3', [text(value.en,4000), text(value.fr,4000), key]);
  }
  return payload();
};

export const config = { path: '/admin-cms/content', method: ['GET','PUT'] };
