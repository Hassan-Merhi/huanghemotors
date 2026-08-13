# Wave 4 — Moto Track + Leads/WhatsApp Setup

Wave 4 adds a production-safe bridge between Huanghe Motors and Moto Track plus customer inquiry handling.

## What is implemented

- Public inquiry form on every customer-facing page.
- Model-aware WhatsApp deep links (English/French).
- D1 lead inbox with statuses: new, contacted, qualified, closed, spam.
- Admin operations screen at `/admin/operations.html`.
- Public stock endpoint that exposes only model slug, public availability, optional public quantity and last-sync metadata.
- Moto Track model mapping by an external public key.
- Manual **Sync now** action and a Cloudflare cron every 15 minutes.
- Strict adapter: Moto Track costs, margins, suppliers, chassis/VIN details and other internal fields are never written into the public CMS.
- If Moto Track is unavailable, the website keeps the last successful public stock state instead of blanking the catalogue.

## Apply the Wave 4 database migration

After Wave 3's `0001_admin_content.sql` has been applied:

```bash
npx wrangler@latest d1 migrations apply huanghe-motors --remote
```

This applies `migrations/0002_wave4.sql`.

## WhatsApp

No phone number is committed to GitHub. After deployment:

1. Open `/admin/operations.html`.
2. Enter the Huanghe Motors Lubumbashi WhatsApp number in international digits only (for example `243...`).
3. Choose whether public quantities should be visible.
4. Save.

If no WhatsApp number is configured, the website still accepts inquiry forms but hides the WhatsApp action.

## Moto Track connection

The exact Moto Track repository/API is not available in the connected GitHub account, so Wave 4 deliberately uses a configurable adapter rather than guessing an endpoint or schema.

Set these Worker secrets/variables in Cloudflare:

```bash
npx wrangler@latest secret put MOTOTRACK_URL
npx wrangler@latest secret put MOTOTRACK_TOKEN
npx wrangler@latest secret put LEAD_RATE_SALT
```

- `MOTOTRACK_URL`: HTTPS endpoint that returns the public inventory feed.
- `MOTOTRACK_TOKEN`: optional bearer token used only server-side.
- `LEAD_RATE_SALT`: random secret used to hash visitor IPs for inquiry rate limiting. No raw IP is stored.

The adapter accepts common JSON feed shapes such as:

```json
{
  "inventory": [
    {"slug": "eagle", "quantity": 8},
    {"slug": "super", "quantity": 0}
  ]
}
```

It also recognizes `stock`, `models`, or `data` arrays, and common identifier fields (`slug`, `model_slug`, `model`, `code`, `id`, `name`). Configure the exact external key for Eagle/Super from the admin operations screen.

### Availability rule when Moto Track returns only quantity

- `0` → out of stock
- `1–3` → low stock
- `4+` → in stock

If Moto Track explicitly returns one of `in_stock`, `low_stock`, `out_of_stock`, `coming_soon`, or `inquire`, that status is respected.

## Lead anti-spam controls

- Honeypot field for basic bot suppression.
- Very-fast submissions are rejected.
- Hashed per-IP rate limit: 5 inquiries per hour.
- Raw visitor IP addresses are not persisted.

## Verification

```bash
npm run check
```

GitHub Actions runs the same repository verification on pushes/PRs.
