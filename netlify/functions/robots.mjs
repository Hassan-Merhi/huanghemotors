import { buildRobots } from '../lib/seo.mjs';
export default async (request) => {
  const url = new URL(request.url);
  return new Response(request.method === 'HEAD' ? null : buildRobots(url.origin), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public,max-age=3600' } });
};
export const config = { path: '/robots.txt' };
