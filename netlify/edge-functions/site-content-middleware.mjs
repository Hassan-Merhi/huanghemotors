import { applySitePageContent } from '../lib/site-page-content.mjs';

export default async (request, context) => {
  const url = new URL(request.url);
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  let transformed = await applySitePageContent(html, url, response.status);
  if (!transformed.includes('/assets/site-content.css')) {
    transformed = transformed.replace('</head>', '<link rel="stylesheet" href="/assets/site-content.css"></head>');
  }
  return new Response(transformed, response);
};

export const config = {
  path: '/*',
  excludedPath: ['/api/*', '/media/*', '/assets/*', '/.netlify/*', '/robots.txt', '/sitemap.xml'],
};
