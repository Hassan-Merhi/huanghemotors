import { siteContentData } from './site-render.mjs';

const FALLBACK_IMAGES = {
  'home.hero': {
    url: 'https://italian.cargo-motorcycle.com/photo/pl114951238-3_wheel_cargo_motorcycle_200cc_engine_2_0m_cargo_box_motorized_tricycle_for_loading_heavy_goods.jpg',
    alt: 'Red Huanghe motorcycle cargo tricycle',
  },
  'home.heritage.main': {
    url: 'https://french.cargo-motorcycle.com/photo/pl27484960-army_200cc_cargo_tricycle_fuel_three_wheeler_cargo_for_merchants_and_farmers.jpg',
    alt: 'Green Huanghe cargo motorcycle',
  },
  'home.heritage.side': {
    url: 'https://italian.cargo-motorcycle.com/photo/pl114951237-3_wheel_cargo_motorcycle_200cc_engine_2_0m_cargo_box_motorized_tricycle_for_loading_heavy_goods.jpg',
    alt: 'Huanghe red cargo motorcycle side view',
  },
};

export async function applySitePageContent(html, url, status = 200) {
  if (url.pathname.startsWith('/admin/')) {
    if ((url.pathname === '/admin/' || url.pathname === '/admin/index.html') && !html.includes('Website content')) {
      html = html.replace('<div class="sidebar-footer">', '<div class="sidebar-footer"><a href="content.html">Website content</a>');
    }
    if ((url.pathname === '/admin/' || url.pathname === '/admin/index.html') && !html.includes('/admin/photo-link.js')) {
      html = html.replace('</body>', '<script src="/admin/photo-link.js" defer></script></body>');
    }
    return html;
  }
  if (status >= 400) return html;

  const data = await siteContentData();
  for (const [slot, fallback] of Object.entries(FALLBACK_IMAGES)) {
    const media = data.media?.[slot];
    if (!media?.url) continue;
    html = html.replace(fallback.url, attr(media.url));
    if (media.alt_en) html = html.replace(`alt="${fallback.alt}"`, `alt="${attr(media.alt_en)}"`);
  }

  const showroom = data.media?.['dealership.showroom'];
  if (showroom?.url && html.includes('class="city-map-visual"')) {
    const image = `<img class="site-showroom-photo" src="${attr(showroom.url)}" alt="${attr(showroom.alt_en || 'Huanghe Motors showroom')}">`;
    html = html.replace(/(<div class="city-map-visual"[^>]*>)/, `$1${image}`);
  }

  const payload = `<script id="site-content-data" type="application/json">${safeJson(data)}</script><script src="/assets/site-content.js" defer></script>`;
  return html.replace('</body>', `${payload}</body>`);
}

function attr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
