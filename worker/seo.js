const STATIC_PAGES = [
  ['/', 'Huanghe Motors Lubumbashi | Eagle & Super Motorcycles', 'Discover Huanghe Motors in Lubumbashi, including Eagle, Super and current motorcycle availability.'],
  ['/eagle.html', 'Eagle Motorcycle | Huanghe Motors Lubumbashi', 'Discover the Huanghe Eagle motorcycle range available through Huanghe Motors in Lubumbashi.'],
  ['/super.html', 'Super Motorcycle | Huanghe Motors Lubumbashi', 'Discover the Huanghe Super motorcycle range available through Huanghe Motors in Lubumbashi.'],
  ['/dealership.html', 'Huanghe Motors Lubumbashi Dealer | Motorcycles in DR Congo', 'Visit Huanghe Motors in Lubumbashi for Eagle, Super and current motorcycle availability.'],
];

export async function handleSeoRoute(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (url.pathname === '/robots.txt') {
    const body = buildRobots(url.origin);
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }
  if (url.pathname === '/sitemap.xml') {
    let models = [];
    try {
      const result = await env.DB.prepare(
        'SELECT slug, updated_at FROM models WHERE published=1 ORDER BY sort_order,name'
      ).all();
      models = result.results || [];
    } catch {
      // Static URLs still provide a valid sitemap before D1 is provisioned.
    }
    const body = buildSitemap(url.origin, models);
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=900',
      },
    });
  }
  return null;
}

export async function applySeo(response, env, url, resolvedModel = null) {
  const hardened = hardenResponse(response, url);
  const type = hardened.headers.get('content-type') || '';
  if (!type.includes('text/html')) return hardened;

  if (url.pathname.startsWith('/admin/') || hardened.status >= 400) {
    hardened.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    return hardened;
  }

  const seo = await pageSeo(env, url, resolvedModel);
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
    `<script type="application/ld+json">${safeJson(organization)}</script>`,
  ];
  if (seo.image) {
    tags.push(`<meta property="og:image" content="${attr(seo.image)}">`);
    tags.push(`<meta name="twitter:image" content="${attr(seo.image)}">`);
  }

  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(seo.title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute('content', seo.description); } })
    .on('head', { element(el) { el.append(tags.join(''), { html: true }); } })
    .transform(hardened);
}

export function hardenResponse(response, url) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('strict-transport-security', 'max-age=31536000');
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    headers.set('cache-control', 'no-store');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function buildRobots(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function buildSitemap(origin, models = []) {
  const urls = [
    { path: '/' },
    { path: '/eagle.html' },
    { path: '/super.html' },
    { path: '/dealership.html' },
  ];
  for (const model of models) {
    const slug = String(model.slug || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug) || slug === 'eagle' || slug === 'super') continue;
    urls.push({ path: `/motorcycle.html?model=${encodeURIComponent(slug)}`, lastmod: dateOnly(model.updated_at) });
  }
  const body = urls.map((item) => {
    const loc = xml(`${origin}${item.path}`);
    const lastmod = item.lastmod ? `<lastmod>${xml(item.lastmod)}</lastmod>` : '';
    return `<url><loc>${loc}</loc>${lastmod}</url>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function metadataForPath(origin, pathname, model = null) {
  if (model) {
    const title = `${model.name} Motorcycle | Huanghe Motors Lubumbashi`;
    const description = compact(model.description_en) ||
      `Discover the ${model.name} motorcycle available through Huanghe Motors in Lubumbashi.`;
    return {
      title,
      description,
      canonical: `${origin}/motorcycle.html?model=${encodeURIComponent(model.slug)}`,
      image: model.image_key ? `${origin}/media/${model.image_key}` : '',
    };
  }
  const entry = STATIC_PAGES.find(([path]) => path === pathname) || STATIC_PAGES[0];
  return {
    title: entry[1],
    description: entry[2],
    canonical: `${origin}${entry[0]}`,
    image: `${origin}/assets/logo.svg`,
  };
}

async function pageSeo(env, url, resolvedModel) {
  if (resolvedModel) return metadataForPath(url.origin, url.pathname, resolvedModel);
  const querySlug = url.pathname === '/motorcycle.html' ? url.searchParams.get('model') || '' : '';
  const slug = querySlug || (url.pathname === '/eagle.html' ? 'eagle' : url.pathname === '/super.html' ? 'super' : '');
  if (/^[a-z0-9-]+$/.test(slug)) {
    try {
      const model = await fetchSeoModel(env, slug);
      if (model) {
        const meta = metadataForPath(url.origin, url.pathname, model);
        if (slug === 'eagle' || slug === 'super') meta.canonical = `${url.origin}/${slug}.html`;
        return meta;
      }
    } catch {
      // Fall through to static SEO metadata.
    }
  }
  return metadataForPath(url.origin, url.pathname);
}

async function fetchSeoModel(env, slug) {
  const model = await env.DB.prepare(
    `SELECT m.slug,m.name,m.description_en,m.updated_at,
      (SELECT object_key FROM model_images i WHERE i.model_slug=m.slug ORDER BY i.is_primary DESC,i.sort_order,i.created_at LIMIT 1) image_key
     FROM models m WHERE m.slug=?1 AND m.published=1`
  ).bind(slug).first();
  return model || null;
}

export function organizationJsonLd(origin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Huanghe Motors',
    url: `${origin}/`,
    logo: `${origin}/assets/logo.svg`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lubumbashi',
      addressCountry: 'CD',
    },
    areaServed: {
      '@type': 'City',
      name: 'Lubumbashi',
    },
  };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function dateOnly(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}
function xml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function attr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
