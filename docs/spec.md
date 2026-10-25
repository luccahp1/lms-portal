# Client Portal — Product Spec v1

## What it is

A branded portal where each client logs in and sees their whole relationship with the agency in one place: monthly updates, requests, messages, files, their website's results and health, and invoices. It replaces monthly PDF reports and email threads.

**Build order:** the agency ↔ client relationship comes first (updates, requests, messages, files, billing). Secondary features (leads inbox, performance, site health) are designed in the mockup but built later.

Three roles for the business:

1. **Retention tool** for our own clients (free, included).
2. **Differentiator** in sales pitches: most agencies still email PDFs.
3. **SaaS product** sold to other agencies later.

## Users

- **Client (owner only):** one login per business, magic link (no password).
- **Agency admin:** sees all of the agency's clients, posts updates, handles requests, logs work and invoices.
- **Platform super-admin (us):** manages agencies once the product is sold to others.

Tenancy: **Platform → Agencies → Clients**. Every table carries `agency_id`; row-level security isolates agencies and clients.

## Modules

Each client only sees modules for services they buy.

| Module | Client sees | Data source |
|---|---|---|
| Home | Monthly update from the agency (wins / working on / next month), headline numbers, latest leads, work log, requests, next invoice | Agency writes the update (~10 min/client/month) |
| Leads inbox *(later)* | Submissions from the client's own website forms, status New/Contacted | Site forms POST to the portal API |
| Performance *(later)* | Visitors, top pages, traffic sources | Privacy-friendly analytics with an API (Umami / Plausible) |
| Site health | Uptime, SSL, speed score, last backup | Uptime cron + PageSpeed API + deploy hooks |
| Work log | "What we did for you" feed | Git commits tagged client-visible (optional integration) + manual entries |
| Requests | Change requests with status + comment thread | Built in |
| Messages | General chat with the agency | Built in (realtime) |
| Files & approvals | Designs/docs with Approve / Request changes | Built in (storage) |
| Billing | Plan, invoices, paid/unpaid | Built in (manual invoices first, Stripe later) |
| SEO / Ads | Placeholder until a client buys those | Search Console / Meta / Google Ads APIs later |

## Roadmap

| Phase | Scope | Users |
|---|---|---|
| 1. MVP (2–3 wks) | Multi-tenant base, magic-link auth, Home + monthly note, Requests, Messages, Files/approvals, manual invoices, admin panel | Our clients |
| 2. Secondary features (separate session) | Leads inbox from site forms, performance/analytics, site health, git work log | Our clients |
| 3. Agencies beta | Agency signup, branding (logo/colors + "Powered by"), Stripe subscriptions, super-admin, landing page + waitlist | 1 partner agency, then a few more |
| 4. Grow | Stripe client payments, SEO/Ads modules, custom domains, full white-label plan, premium client tier | Paying agencies |

Strategy: dogfood with our own clients for 2–3 months before opening to other agencies, but build multi-tenant from day one.

## White-label

Agencies get their logo and accent color with a "Powered by [Portal]" badge. Full white-label (custom domain, no badge) is a higher plan later.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, hosted on Vercel
- Supabase: Postgres + row-level security, magic-link auth, storage, realtime
- Stripe for billing (agency subscriptions, later client payments)

## Core data model

`agencies` · `clients` · `users` (role: super_admin / agency_admin / client) · `client_services` (enabled modules) · `requests` + `request_comments` · `messages` · `files` · `invoices` · `work_log` · `leads` · `monthly_notes` · `site_metrics`

## Not doing for now

- Email integrations (no inbox syncing, no notification emails)
- Lead sources other than the client's own website forms

## Design direction

Mercury-style: light, calm, premium. Thin white sidebar, one big headline number (leads this month), soft gray bordered cards, single accent color (swappable per agency), Inter. Performance pages follow Plausible's one-page clarity.

Mockup: `design/client-portal-mockup.dc.html`.

## Key risk

The portal only feels premium if it stays fresh. Automate everything possible (leads, analytics, health, work log) so the only manual task is the monthly note.

## Open questions

- Agency name, portal product name, domain
- Pricing for agencies; premium client tier
