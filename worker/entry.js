import base from './index.js';
import { handleWave4, scheduledWave4 } from './wave4.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const wave4 = await handleWave4(request, env, url);
    if (wave4) return wave4;
    const response = await base.fetch(request, env, ctx);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return response;
    if (url.pathname === '/admin/' || url.pathname === '/admin/index.html') {
      return new HTMLRewriter().on('.sidebar-footer', { element(el) { el.prepend('<a href="operations.html">Leads & integrations</a>', { html: true }); } }).transform(response);
    }
    if (url.pathname.startsWith('/admin/')) return response;
    return new HTMLRewriter()
      .on('head', { element(el) { el.append('<link rel="stylesheet" href="/assets/wave4.css">', { html: true }); } })
      .on('body', { element(el) { el.append('<script src="/assets/wave4.js" defer></script>', { html: true }); } })
      .transform(response);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledWave4(env));
  },
};
