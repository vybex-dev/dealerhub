# DealerHub: Phases 1-2

Signup → tenant creation → add property → public property page → enquiry → dealer dashboard.

**Status:** compiles, typechecks, and 22 unit tests pass (routing, validation, slugs, image processing).
**Not yet verified:** nothing has been run against a live Supabase project or a browser. The RLS isolation script
(`supabase/tests/isolation.sql`) is written but has not been executed. Billing, photos and email are NOT implemented.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_phase1.sql`.
2. Supabase → Auth → URL config: add `http://localhost:3000/**` (and later your production domain) as redirect URLs.
   For fast local testing you may turn off "Confirm email".
3. `cp .env.example .env.local` and fill in the values (see below).
4. `npm install && npm run dev`
5. Local subdomains work in most browsers: sign up at `http://localhost:3000`, pick `kushal`, you land on
   `http://kushal.localhost:3000/dashboard`.

## Environment variables
| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_ROOT_DOMAIN | `localhost:3000` locally, `yourdomain.com` in production |
| NEXT_PUBLIC_PROTOCOL | `http` locally, `https` in production |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase project keys |
| SUPABASE_SERVICE_ROLE_KEY | Server only. Used solely by `/api/leads`. Never expose it. |
| SESSION_COOKIE_DOMAIN | `.yourdomain.com` in production so login on the root domain works on dealer subdomains. Empty locally. |

## Deploying on Vercel (verify current limits before relying on this)
- Add `yourdomain.com` and `*.yourdomain.com` to the Vercel project.
- Wildcard domains on Vercel need Vercel's nameservers for the domain (so it can issue the wildcard certificate). Check current docs and plan limits.
- Set the environment variables above in Vercel.

## Tests
- `npm test`: unit tests.
- `supabase/tests/isolation.sql`: run on a disposable Supabase project after replacing the two user UUIDs.

## Known Phase 1 limitations (deliberate, tracked in the plan)
- **Session cookie is shared across subdomains** (parent-domain cookie) for simplicity. Every dashboard action still checks membership of the tenant resolved from the hostname, but a host-only cookie with a token handoff is the safer end state.
- **Rate limiting is in-memory** and weak on serverless. Replace with Redis + a bot challenge (Turnstile) before launch.
- No email notifications, no photos, no subscription gating (`tenants.status` only), no edit-property page, no EMI calculator or map yet.
- Tenant pages are `no-store`; tagged caching comes with the public-site milestone.

## Phase 2: photos and property editing
Run `supabase/migrations/0002_images.sql` after 0001. Then fill in the R2 variables in `.env.example`.

**Flow:** browser asks `/api/uploads/init` (auth, tenant, photo-count and storage checks) → uploads straight to a
**private** R2 bucket with a 5-minute signed URL (this avoids Vercel's ~4.5 MB request-body limit) → `/api/uploads/finalize`
re-reads the file, verifies the real content with sharp, strips EXIF/GPS, writes thumb/medium/large WebP variants to a
**public** bucket, deletes the raw file, and records the real stored size. First ready photo becomes the cover.

**Cloudflare setup (verify against current docs):**
1. Create two buckets: `R2_BUCKET_PRIVATE` (no public access) and `R2_BUCKET_PUBLIC`.
2. Attach a custom domain (e.g. `img.yourdomain.com`) to the public bucket and set `NEXT_PUBLIC_IMAGE_BASE_URL`.
3. Add a CORS rule on the **private** bucket allowing `PUT` with header `Content-Type` from your site origins. If R2 does not
   accept wildcard subdomain origins, allow `*` for PUT only: uploads are still gated by the short-lived signed URL.
4. Create an R2 API token limited to those two buckets.

**Limits until plans exist (Phase 7):** `MAX_PHOTOS_PER_PROPERTY` (20), `MAX_STORAGE_BYTES` (500 MB), 8 MB per file, 40 MP per image.

**Cleanup:** `vercel.json` schedules `/api/cron/cleanup` daily. It removes uploads still pending after an hour. Set `CRON_SECRET`.
Check that your Vercel plan allows the cron frequency.

**Publishing now requires** price, city, locality and at least one photo.

**Tests:** `supabase/tests/isolation_images.sql` (run like the Phase 1 script).

## Known Phase 2 limitations
- Signed upload URLs do not hard-enforce size at R2; oversize or fake files are rejected and deleted at finalize.
- The photo-count and storage checks are not atomic: two simultaneous uploads could slightly exceed a limit.
- Variant URLs are unguessable (UUID) but public once processed, including for draft listings. Drafts are not listed anywhere.
- Reordering uses up/down buttons (no drag and drop). No floor plans or video yet.
- Not yet run against real R2/Supabase. No Open Graph image, map, or EMI calculator yet.
