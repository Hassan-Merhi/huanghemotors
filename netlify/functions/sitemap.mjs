import { buildSitemap } from '../lib/seo.mjs';
export default async (request) => {
  const url = new URL(request.url);
  const body = await buildSitemap(url.origin);
  return new Response(request.method === 'HEAD' ? null : body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public,max-age=900' } });
};
export const config = { path: '/sitemap.xml' };
