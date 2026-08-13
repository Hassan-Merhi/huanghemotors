import crypto from 'node:crypto';

export const COOKIE = 'hm_admin';
const TTL = 43_200;

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function equalHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a || '') || !/^[a-f0-9]{64}$/i.test(b || '')) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return '';
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyPassword(password) {
  return equalHex(hashPassword(password), process.env.ADMIN_PASSWORD_SHA256 || '');
}

export function makeSessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const token = sign({ exp, n: crypto.randomUUID() });
  return {
    exp,
    cookie: `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL}`,
  };
}

export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function sessionFromRequest(request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const cookie = (request.headers.get('cookie') || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const [body, sig, extra] = cookie.slice(COOKIE.length + 1).split('.');
  if (!body || !sig || extra) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  let actual;
  try { actual = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Number.isInteger(payload.exp) && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
