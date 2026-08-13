# Huanghe Motors Admin Setup

Wave 3 adds a production-oriented admin/content system using Cloudflare Workers, D1 and R2.

## Implemented

- `/admin/` password login
- 12-hour HttpOnly/Secure/SameSite=Strict signed session cookie
- Motorcycle create/edit/unpublish/delete (Eagle and Super cannot be deleted)
- English and French descriptions
- Availability and confirmed-spec fields
- Multiple image uploads, primary-image selection, alt text, reordering and deletion
- D1 content storage and audit records
- R2 image storage
- Public `/api/public/models` endpoints
- Public pages hydrate from CMS data and retain safe static fallback content if the API is unavailable

## One-time Cloudflare provisioning

The repository intentionally does not contain production IDs or secrets.

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`.
2. Create the D1 database and paste its generated database ID into `wrangler.jsonc`.
3. Create the R2 bucket named `huanghe-motors-media`.
4. Apply `migrations/0001_admin_content.sql` to the production D1 database.
5. Set two Worker secrets:
   - `ADMIN_PASSWORD_SHA256`: SHA-256 hex digest of the admin password.
   - `SESSION_SECRET`: a long random secret used to HMAC-sign admin sessions.
6. Deploy the Worker/site.

Example CLI flow:

```bash
npx wrangler@latest d1 create huanghe-motors
npx wrangler@latest r2 bucket create huanghe-motors-media
npx wrangler@latest d1 migrations apply huanghe-motors --remote
npx wrangler@latest secret put ADMIN_PASSWORD_SHA256
npx wrangler@latest secret put SESSION_SECRET
npx wrangler@latest deploy
```

Generate the password digest locally without putting the password in the repository:

```bash
node -e "const c=require('node:crypto');const p=process.argv[1];console.log(c.createHash('sha256').update(p).digest('hex'))" "YOUR-ADMIN-PASSWORD"
```

Generate `SESSION_SECRET` with a password manager or a cryptographically secure random generator and store it only as a Cloudflare secret.

## Image rules

- Accepted: JPEG, PNG, WebP, AVIF
- Maximum: 6 MB per file
- SVG uploads are intentionally rejected
- Uploaded media is stored under model-scoped R2 keys
- Deleting a non-core model deletes its uploaded objects

## Verification

```bash
npm run check
```
