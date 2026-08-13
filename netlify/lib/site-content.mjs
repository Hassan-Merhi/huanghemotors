import { getStore } from '@netlify/blobs';
import { query, one, exec } from './db.mjs';
import { sessionFromRequest } from './auth.mjs';
import { json, randomId, readJson, text } from './common.mjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_IMAGE = 4 * 1024 * 1024;
const MEDIA_SLOTS = [
  { slot: 'home.hero', label: 'Homepage hero photo' },
  { slot: 'home.heritage.main', label: 'Homepage heritage large photo' },
  { slot: 'home.heritage.side', label: 'Homepage heritage side photo' },
  { slot: 'dealership.showroom', label: 'Dealership / showroom photo' },
];
const MEDIA_SLOT_SET = new Set(MEDIA_SLOTS.map((item) => item.slot));

function mediaStore() { return getStore('huanghe-motors-media'); }

async function audit(action, detail) {
  await exec('INSERT INTO admin_audit(id,action,model_slug,detail) VALUES($1,$2,NULL,$3)', [randomId(), action, text(detail, 1000)]);
}

async function contentRows() {
  return query('SELECT key,group_name,label,value_en,value_fr,input_type,sort_order,updated_at FROM site_content ORDER BY sort_order,key');
}

async function mediaRows() {
  return query('SELECT slot,label,object_key,content_type,alt_en,alt_fr,updated_at FROM site_media ORDER BY slot');
}

function mediaPayload(rows, includeLabels = false) {
  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const source = includeLabels ? MEDIA_SLOTS : rows;
  const output = {};
  for (const item of source) {
    const row = includeLabels ? bySlot.get(item.slot) : item;
    output[item.slot] = row ? {
      slot: item.slot,
      label: includeLabels ? item.label : row.label,
      url: `/media/${row.object_key}`,
      object_key: includeLabels ? row.object_key : undefined,
      content_type: row.content_type,
      alt_en: row.alt_en || '',
      alt_fr: row.alt_fr || '',
      updated_at: row.updated_at,
    } : {
      slot: item.slot,
      label: item.label,
      url: '',
      object_key: '',
      content_type: '',
      alt_en: '',
      alt_fr: '',
      updated_at: null,
    };
  }
  return output;
}

async function publicContent() {
  try {
    const [fields, media] = await Promise.all([contentRows(), mediaRows()]);
    return json({
      content: Object.fromEntries(fields.map((row) => [row.key, { en: row.value_en, fr: row.value_fr }])),
      media: mediaPayload(media, false),
    }, 200, { 'cache-control': 'public,max-age=60' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'site_content_public_error', message: error instanceof Error ? error.message : String(error) }));
    return json({ content: {}, media: {} }, 200, { 'cache-control': 'public,max-age=30' });
  }
}

async function adminContent() {
  const [fields, media] = await Promise.all([contentRows(), mediaRows()]);
  return json({ fields, media: mediaPayload(media, true) });
}

async function saveContent(request) {
  const body = await readJson(request, 180_000);
  const values = body?.content && typeof body.content === 'object' ? body.content : {};
  const allowed = new Set((await contentRows()).map((row) => row.key));
  let updated = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || !value || typeof value !== 'object') continue;
    await exec('UPDATE site_content SET value_en=$1,value_fr=$2,updated_at=NOW() WHERE key=$3', [text(value.en, 4000), text(value.fr, 4000), key]);
    updated += 1;
  }
  await audit('site-content.update', `${updated} fields`);
  return adminContent();
}

function slotFromPath(path) {
  const raw = decodeURIComponent(path.replace(/^\/api\/admin\/site-media\//, ''));
  return MEDIA_SLOT_SET.has(raw) ? raw : '';
}

async function uploadMedia(request, slot) {
  const body = await readJson(request, 5_900_000);
  const type = String(body.type || '');
  let bytes;
  try { bytes = Buffer.from(String(body.dataBase64 || ''), 'base64'); } catch { bytes = Buffer.alloc(0); }
  if (!IMAGE_TYPES.has(type)) return json({ error: 'Use JPEG, PNG, WebP or AVIF images' }, 400);
  if (!bytes.length || bytes.length > MAX_IMAGE) return json({ error: 'On Netlify, images must be 4 MB or smaller' }, 413);

  const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  const key = `site/${slot}/${randomId()}.${ext}`;
  const old = await one('SELECT object_key FROM site_media WHERE slot=$1', [slot]);
  const label = MEDIA_SLOTS.find((item) => item.slot === slot)?.label || slot;
  await mediaStore().set(key, new Blob([bytes], { type }), { metadata: { contentType: type, cacheControl: 'public,max-age=31536000,immutable' } });
  try {
    await exec(`INSERT INTO site_media(slot,label,object_key,content_type,alt_en,alt_fr,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT(slot) DO UPDATE SET label=EXCLUDED.label,object_key=EXCLUDED.object_key,content_type=EXCLUDED.content_type,alt_en=EXCLUDED.alt_en,alt_fr=EXCLUDED.alt_fr,updated_at=NOW()`,
      [slot, label, key, type, text(body.alt_en, 180), text(body.alt_fr, 180)]);
  } catch (error) {
    await mediaStore().delete(key);
    throw error;
  }
  if (old?.object_key && old.object_key !== key) await mediaStore().delete(old.object_key);
  await audit('site-media.upload', slot);
  return adminContent();
}

async function updateMedia(request, slot) {
  const existing = await one('SELECT slot FROM site_media WHERE slot=$1', [slot]);
  if (!existing) return json({ error: 'Upload a photo for this slot first' }, 404);
  const body = await readJson(request, 8192);
  await exec('UPDATE site_media SET alt_en=$1,alt_fr=$2,updated_at=NOW() WHERE slot=$3', [text(body.alt_en, 180), text(body.alt_fr, 180), slot]);
  await audit('site-media.update', slot);
  return adminContent();
}

async function deleteMedia(slot) {
  const existing = await one('SELECT object_key FROM site_media WHERE slot=$1', [slot]);
  if (!existing) return adminContent();
  await mediaStore().delete(existing.object_key);
  await exec('DELETE FROM site_media WHERE slot=$1', [slot]);
  await audit('site-media.delete', slot);
  return adminContent();
}

export async function handleSiteContentApi(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/public/site-content' && method === 'GET') return publicContent();
  const isAdminContent = path === '/api/admin/site-content';
  const isAdminMedia = path.startsWith('/api/admin/site-media/');
  if (!isAdminContent && !isAdminMedia) return null;
  if (!sessionFromRequest(request)) return json({ error: 'Unauthorized' }, 401);

  if (isAdminContent && method === 'GET') return adminContent();
  if (isAdminContent && method === 'PUT') return saveContent(request);
  if (isAdminMedia) {
    const slot = slotFromPath(path);
    if (!slot) return json({ error: 'Unknown media slot' }, 404);
    if (method === 'POST') return uploadMedia(request, slot);
    if (method === 'PATCH') return updateMedia(request, slot);
    if (method === 'DELETE') return deleteMedia(slot);
  }
  return json({ error: 'Method not allowed' }, 405);
}
