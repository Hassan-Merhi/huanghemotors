import { transformHtml } from '../lib/seo.mjs';

export default async (request, context) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') || url.pathname.startsWith('/.netlify/')) return;
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('strict-transport-security', 'max-age=31536000');
  if (url.pathname.startsWith('/admin/') || response.status >= 400) headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  const type = headers.get('content-type') || '';
  if (!type.includes('text/html')) return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  const html = await response.text();
  let transformed = await transformHtml(html, url, response.status);
  if (url.pathname.startsWith('/admin/')) {
    transformed = transformed.replace('</head>', '<style id="admin-hidden-guard">[hidden]{display:none!important}</style></head>');
  }
  return new Response(transformed, { status: response.status, statusText: response.statusText, headers });
};

export const config = {
  path: '/*',
  excludedPath: ['/api/*', '/media/*', '/assets/*', '/.netlify/*', '/robots.txt', '/sitemap.xml'],
};
