import crypto from 'node:crypto';

export function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function numberOrNull(value) {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

export async function readJson(request, maxBytes = 32768) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > maxBytes) throw new Error('Request body too large');
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('Request body too large');
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export function randomId() {
  return crypto.randomUUID();
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
