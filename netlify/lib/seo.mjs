import { one, query } from './db.mjs';

const STATIC_PAGES = [
  ['/', 'Huanghe Motors Lubumbashi | Eagle & Super Motorcycles', 'Discover Huanghe Motors in Lubumbashi, including Eagle, Super and current motorcycle availability.'],
  ['/eagle.html', 'Eagle Motorcycle | Huanghe Motors Lubumbashi', 'Discover the Huanghe Eagle motorcycle range available through Huanghe Motors in Lubumbashi.'],
  ['/super.html', 'Super Motorcycle | Huanghe Motors Lubumbashi', 'Discover the Huanghe Super motorcycle range available through Huanghe Motors in Lubumbashi.'],
  ['/dealership.html', 'Huanghe Motors Lubumbashi Dealer | Motorcycles in DR Congo', 'Visit Huanghe Motors in Lubumbashi for Eagle, Super and current motorcycle availability.'],
];

export function buildRobots(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export async function buildSitemap(origin) {
  let models = [];
  try { models = await query('SELECT slug,updated_at FROM models WHERE published=1 ORDER BY sort_order,name'); } catch {}
  const urls = [
    { path: '/' }, { path: '/eagle.html' }, { path: '/super.html' }, { path: '/dealership.html' },
  ];
  for (const model of models) {
    const slug = String(model.slug || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug) || slug === 'eagle' || slug === 'super') continue;
    urls.push({ path: `/motorcycle.html?model=${encodeURIComponent(slug)}`, lastmod: dateOnly(model.updated_at) });
  }
  const body = urls.map((item) => `<url><loc>${xml(`${origin}${item.path}`)}</loc>${item.lastmod ? `<lastmod>${xml(item.lastmod)}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export async function metadataForUrl(url) {
  const querySlug = url.pathname === '/motorcycle.html' ? url.searchParams.get('model') || '' : '';
  const slug = querySlug || (url.pathname === '/eagle.html' ? 'eagle' : url.pathname === '/super.html' ? 'super' : '');
  if (/^[a-z0-9-]+$/.test(slug) && slug) {
    try {
      const model = await one(`SELECT m.slug,m.name,m.description_en,m.updated_at,
        (SELECT object_key FROM model_images i WHERE i.model_slug=m.slug ORDER BY i.is_primary DESC,i.sort_order,i.created_at LIMIT 1) image_key
        FROM models m WHERE m.slug=$1 AND m.published=1`, [slug]);
      if (model) {
        return {
          title: `${model.name} Motorcycle | Huanghe Motors Lubumbashi`,
          description: compact(model.description_en) || `Discover the ${model.name} motorcycle available through Huanghe Motors in Lubumbashi.`,
          canonical: slug === 'eagle' || slug === 'super' ? `${url.origin}/${slug}.html` : `${url.origin}/motorcycle.html?model=${encodeURIComponent(model.slug)}`,
          image: model.image_key ? `${url.origin}/media/${model.image_key}` : `${url.origin}/assets/logo.svg`,
        };
      }
    } catch {}
  }
  const entry = STATIC_PAGES.find(([path]) => path === url.pathname) || STATIC_PAGES[0];
  return { title: entry[1], description: entry[2], canonical: `${url.origin}${entry[0]}`, image: `${url.origin}/assets/logo.svg` };
}

export function organizationJsonLd(origin) {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'Huanghe Motors', url: `${origin}/`, logo: `${origin}/assets/logo.svg`,
    address: { '@type': 'PostalAddress', addressLocality: 'Lubumbashi', addressCountry: 'CD' },
    areaServed: { '@type': 'City', name: 'Lubumbashi' },
  };
}

export async function transformHtml(html, url, status = 200) {
  if (url.pathname.startsWith('/admin/')) {
    if ((url.pathname === '/admin/' || url.pathname === '/admin/index.html') && !html.includes('Leads & integrations')) {
      html = html.replace('<div class="sidebar-footer">', '<div class="sidebar-footer"><a href="operations.html">Leads & integrations</a>');
    }
    return html;
  }
  if (status >= 400) return html;
  const seo = await metadataForUrl(url);
  const organization = organizationJsonLd(url.origin);
  const tags = [
    `<link rel="canonical" href="${attr(seo.canonical)}">`,
    '<link rel="manifest" href="/site.webmanifest">',
    '<meta property="og:site_name" content="Huanghe Motors">',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${attr(seo.title)}">`,
    `<meta property="og:description" content="${attr(seo.description)}">`,
    `<meta property="og:url" content="${attr(seo.canonical)}">`,
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:locale:alternate" content="fr_FR">',
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${attr(seo.title)}">`,
    `<meta name="twitter:description" content="${attr(seo.description)}">`,
    `<meta property="og:image" content="${attr(seo.image)}">`,
    `<meta name="twitter:image" content="${attr(seo.image)}">`,
    `<script type="application/ld+json">${safeJson(organization)}</script>`,
  ].join('');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${attr(seo.description)}">`);
  if (!html.includes('assets/wave3.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/wave3.css"></head>');
  if (!html.includes('assets/wave4.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/wave4.css"></head>');
  html = html.replace('</head>', `${tags}</head>`);
  if (!html.includes('assets/cms.js')) html = html.replace('</body>', '<script src="/assets/cms.js" defer></script></body>');
  if (!html.includes('assets/wave4.js')) html = html.replace('</body>', '<script src="/assets/wave4.js" defer></script></body>');
  return html;
}

function compact(value) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160); }
function dateOnly(value) { const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/); return match ? match[0] : ''; }
function xml(value) { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function attr(value) { return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeHtml(value) { return attr(value).replace(/'/g,'&#39;'); }
function safeJson(value) { return JSON.stringify(value).replace(/</g,'\\u003c'); }
