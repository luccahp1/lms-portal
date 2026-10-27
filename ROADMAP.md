# Roadmap

Where the client portal is and what comes next. The *why* behind each feature lives in
[docs/spec.md](docs/spec.md); this file is the order we build things in. Tick items off as
they ship and move finished phases to the top.

**Strategy:** use it with our own clients first and build anything that only matters for
other agencies later. Every phase should either make clients stickier or cut our own admin
time, and keep running costs at $0 until the portal earns money.

---

## ✅ Phase 1: Core portal (live)

Live at **https://portal.londonmarketingsolutions.ca**: home server, Postgres 16, Cloudflare R2
for files, its own Cloudflare Tunnel.

- [x] Multi-tenant base (agency → clients), tenant isolation in the data layer, tested
- [x] Self sign-up via the agency's sign-up link, admin approval, password reset links
- [x] Client Home: monthly update, stats, requests, messages, "What we did for you"
- [x] Requests with comments and client approval
- [x] Messages (refreshes every 15s)
- [x] Files & approvals in R2, signed downloads, 8 GB total cap
- [x] Billing: manual invoices (draft → sent → paid)
- [x] Admin: clients, request inbox, sign-ups, per-client tabs
- [x] Rate limits on login / sign-up / reset

---

## Next up: Housekeeping (small, do first)

Quick wins that protect what's live.

- [x] **Merge PR #1 into `main`.** Production runs from `main` since 2026-10-27.
- [ ] **Off-box database backups.** Nightly `pg_dump` of `lms_portal` copied to R2 (the
      server has one disk). Client data is the one thing we can't lose.
- [ ] **Uptime check** for `/login` (the server's health-check timer, or a free external
      monitor), so an outage doesn't go unnoticed.
- [ ] **CI on GitHub:** typecheck, lint, tests against a Postgres service, and build on
      every push.
- [ ] **Clean-up job:** delete expired sessions and used/expired password links nightly.
- [ ] **Onboard our real clients** and write the first monthly updates. Note what they
      actually use; it decides Phase 3.

## Phase 1.5: Email

londonmarketingsolutions.ca is on Cloudflare, so we can send from `portal@londonmarketingsolutions.ca`
through a free transactional service (e.g. Resend, ~3,000 emails/month free; DNS records in
Cloudflare).

- [ ] Self-service **"Forgot password?"** (replaces admin-made reset links)
- [ ] Email to the client when their sign-up is **approved**
- [ ] Email to us on a **new sign-up** or **new request**
- [ ] Email to the client when we **reply**, **post the monthly update**, **share a file to
      approve**, or **send an invoice** (with a per-person on/off setting)

## Phase 2: Results modules

The "secondary" screens from the mockup: leads, performance, site health. Each client only
sees the modules for services they buy (needs a per-client module switch).

- [ ] **Per-client modules:** admin toggles which sections each client sees
- [ ] **Leads inbox:** the client's own website forms POST to the portal (a per-client key),
      New/Contacted status, count on Home. Website forms only, no email or call tracking.
- [ ] **Performance:** visitors, top pages, sources. Prefer **Cloudflare Web Analytics**
      (free, and our sites are on Cloudflare) via its API; Umami as a fallback.
- [ ] **Site health:** uptime checks, SSL expiry, Google PageSpeed score, last deploy
- [ ] **Automatic work log** from git commits marked client-visible
- [ ] Big headline number on Home switches to leads this month (as in the mockup)

## Phase 3: Selling it to other agencies (beta)

Only once our own clients have used it for a couple of months. Start with the one agency we
know.

- [ ] Agency sign-up and onboarding
- [ ] Branding settings: logo upload, accent color, "Powered by [portal]" badge
- [ ] Per-agency storage limits (today's 8 GB cap is shared by all agencies)
- [ ] Agency billing with **Stripe** subscriptions, plan limits (clients, modules)
- [ ] Super-admin view for us
- [ ] Landing page + waitlist; product name and pricing decided
- [ ] **Hosting move:** managed Postgres + a Node host once agencies pay. Files are already
      in R2; it's a `DATABASE_URL` change plus a data copy.

## Phase 4: Grow

- [ ] Clients pay invoices online (Stripe), invoice PDFs, receipts
- [ ] SEO and Ads modules (Search Console, Google Ads, Meta)
- [ ] Custom domains per agency and a full white-label plan (no badge)
- [ ] Premium client tier (which modules are gated: decide from Phase 2 usage)
- [ ] More than one admin role (owner / staff), activity log

---

## Decisions still open

| Decision | Needed by |
|---|---|
| Portal product name | Phase 3 |
| Pricing for agencies; whether there's a premium client tier | Phase 3 |
| Which email service (Resend vs. others) | Phase 1.5 |
| Analytics source if a client's site isn't on Cloudflare | Phase 2 |

## Not doing (for now)

- Email inbox syncing or reading clients' email
- Lead sources other than the client's own website forms
- Docker / Kubernetes, or anything that needs more than the home server's 8 GB RAM
