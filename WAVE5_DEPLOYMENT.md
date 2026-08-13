# Wave 5 — Production SEO, final checks and deployment

Wave 5 closes the build program with crawl/index controls, security headers, a real 404 response, runtime canonical metadata and a safer Cloudflare asset boundary.

## Production changes

- Runtime `/robots.txt` with `/admin/` and `/api/` excluded from crawling.
- Runtime `/sitemap.xml` using the active host, so it works on a Workers preview URL or future custom domain without hardcoding.
- Canonical URL, Open Graph, Twitter metadata and Organization JSON-LD added to public HTML responses.
- Dynamic CMS-created motorcycles are included in the sitemap at `motorcycle.html?model=<slug>`.
- Admin/API responses receive `X-Robots-Tag: noindex, nofollow, noarchive`.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Unknown routes now return the dedicated `404.html` instead of the homepage with a `200` status.
- `run_worker_first` is enabled so the CMS, lead/WhatsApp and SEO HTML transforms actually run for static HTML requests.
- `.assetsignore` prevents backend source, migrations, tests, docs, Wrangler config and package files from being published as customer-facing static assets.

## Structured data boundary

The exact Huanghe Motors street address and telephone have not been confirmed in the repository. Google LocalBusiness rich-result guidance requires a physical address, so Wave 5 publishes confirmed Organization/location-level data only: Huanghe Motors, Lubumbashi, DR Congo. Once the exact dealer address is supplied, upgrade the markup to the appropriate LocalBusiness subtype and add the verified street address, phone, hours and coordinates.

## One-time Cloudflare production setup

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`.
2. Create the D1 database and replace `PASTE_D1_DATABASE_ID` with the real ID.
3. Create the `huanghe-motors-media` R2 bucket.
4. Apply `migrations/0001_admin_content.sql` and then `migrations/0002_wave4.sql`.
5. Configure `ADMIN_PASSWORD_SHA256`, `SESSION_SECRET` and `LEAD_RATE_SALT` as Worker secrets.
6. Add `MOTOTRACK_URL` and optional `MOTOTRACK_TOKEN` when the real public-stock feed is available.
7. Deploy the Worker and configure the production WhatsApp number from `/admin/operations.html`.
8. Attach the final custom domain when ready.

## Google launch checklist

After the production domain is live, verify it in Google Search Console, submit `/sitemap.xml`, inspect the homepage/Eagle/Super/dealership URLs, and request indexing. Once the exact dealer street address is confirmed and LocalBusiness markup is enabled, validate it with Google's Rich Results Test. Keep `/admin/` out of public navigation and indexing.

## Final checks

Run:

```bash
npm run check
```

After `wrangler.jsonc` contains real Cloudflare IDs:

```bash
npx wrangler@latest whoami
npx wrangler@latest deploy --dry-run
npx wrangler@latest deploy
```

After deployment verify `/`, `/eagle.html`, `/super.html`, `/dealership.html`, `/robots.txt`, `/sitemap.xml`, a nonsense 404 URL, `/admin/`, EN/FR switching, inquiry/WhatsApp behavior, public admin photo changes, and the Moto Track public-data boundary.
