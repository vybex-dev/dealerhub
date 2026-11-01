# DealerHub: Phase 1 vertical slice

Signup → tenant creation → add property → public property page → enquiry → dealer dashboard.

**Status:** compiles, typechecks, and 12 unit tests pass (hostname routing, subdomain validation, price formatting, slugs).
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

## Images (next phase)
Recommended: Cloudflare R2 for storage (no egress fees) with sharp-generated variants at upload, served via a
custom domain on Cloudflare's CDN. Supabase Storage is simpler but costs more at image-heavy scale. Verify current pricing first.
