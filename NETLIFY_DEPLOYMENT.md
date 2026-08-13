# Huanghe Motors — Netlify deployment

This branch converts the Huanghe Motors production stack from Cloudflare-native infrastructure to Netlify-native infrastructure.

## Production architecture

- Static showroom/admin assets: Netlify CDN (`dist/` publish directory)
- API and admin backend: Netlify Functions
- Structured data: Netlify Database (Postgres)
- Motorcycle image storage: Netlify Blobs (`huanghe-motors-media` store)
- SEO/runtime HTML metadata: Netlify Edge Function
- Moto Track refresh: Netlify Scheduled Function every 15 minutes

The public API paths stay unchanged, so the existing EN/FR frontend and admin UI continue using `/api/...` and `/media/...`.

## Important billing note

Netlify Database is available on Netlify credit-based plans. If the account cannot create a Netlify Database, use an external Postgres provider and set the connection string for `@netlify/database`; do not switch the site back to client-only storage.

## Connect the GitHub repository

1. In Netlify, choose **Add new project** → **Import an existing project**.
2. Choose GitHub and select `hassandakikk/huanghemotors`.
3. Production branch should be `main` after this migration is merged.
4. Netlify reads `netlify.toml`; do not manually point the publish directory at the repository root.
5. Build command: `node scripts/build-netlify.mjs`.
6. Publish directory: `dist`.
7. Functions directory: `netlify/functions`.

## Database

The project contains `@netlify/database` plus a Postgres migration under `netlify/database/migrations/`. Netlify can provision the database and applies migrations during deploys.

The baseline migration creates:

- `models`
- `model_images`
- `admin_audit`
- `site_settings`
- `leads`
- `lead_rate_limits`
- `mototrack_mapping`
- `mototrack_sync_log`

It seeds Eagle and Super plus the default settings/mappings.

## Environment variables

Configure these in **Project configuration → Environment variables**. Never commit their values.

Required:

- `ADMIN_PASSWORD_SHA256` — SHA-256 hex digest of the admin password
- `SESSION_SECRET` — long cryptographically random session-signing secret
- `LEAD_RATE_SALT` — separate random salt for hashed inquiry rate limiting

Optional until Moto Track is connected:

- `MOTOTRACK_URL`
- `MOTOTRACK_TOKEN`

Generate the password digest locally:

```bash
node -e "const c=require('node:crypto');const p=process.argv[1];console.log(c.createHash('sha256').update(p).digest('hex'))" "YOUR-ADMIN-PASSWORD"
```

Generate random secrets locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Use a different random value for `SESSION_SECRET` and `LEAD_RATE_SALT`.

## Motorcycle photos

Photos are stored in Netlify Blobs. Because Netlify Functions have a 6 MB buffered payload limit and binary requests incur base64 overhead, this deployment caps dealer image uploads at **4 MB**. Accepted formats remain JPEG, PNG, WebP and AVIF.

## Moto Track schedule

`netlify/functions/mototrack-sync.mjs` is scheduled for:

```text
*/15 * * * *
```

Netlify Scheduled Functions execute in UTC and run only for published deploys. The manual **Sync now** admin action continues to use the normal API function.

## Local verification

```bash
npm install
npm run check
npm run build
```

For full Netlify-local behavior, including Functions and the local Postgres-compatible database:

```bash
npx netlify dev
npx netlify database migrations apply
```

## Production smoke test

After the first published deploy verify:

- `/`
- `/eagle.html`
- `/super.html`
- `/dealership.html`
- `/admin/`
- `/admin/operations.html`
- `/robots.txt`
- `/sitemap.xml`
- a nonsense URL returns the custom 404 page
- EN/FR switch works
- admin login works
- adding/editing motorcycles works
- photo upload/read/delete works
- inquiry submission appears in Leads
- WhatsApp number can be saved
- Moto Track manual sync fails safely until its real endpoint is configured

The old Cloudflare files remain in Git history for rollback/reference, but `netlify.toml` and the `dist/` build make the Netlify stack the active deployment path.
