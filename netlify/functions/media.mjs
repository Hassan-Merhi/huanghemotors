import { getStore } from '@netlify/blobs';

export default async (request, context) => {
  const key = context.params?.splat || new URL(request.url).pathname.replace(/^\/media\//, '');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const store = getStore('huanghe-motors-media');
  const item = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!item) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'content-type': item.metadata?.contentType || 'application/octet-stream',
    'cache-control': item.metadata?.cacheControl || 'public,max-age=31536000,immutable',
    'x-content-type-options': 'nosniff',
    etag: item.etag,
  });
  if (request.headers.get('if-none-match') === item.etag) return new Response(null, { status: 304, headers });
  return new Response(item.data, { headers });
};

export const config = {
  path: '/media/*',
};
