# lms-portal

Client portal for web and marketing agencies. Clients log in to see monthly updates, the work done for them, their website's leads, results and health, and to send requests, messages and files and view invoices, all in one place instead of PDFs and email.

Built first for our own clients, designed multi-tenant so it can be sold to other agencies.

- **Roadmap:** [ROADMAP.md](ROADMAP.md)
- Product spec: [docs/spec.md](docs/spec.md)
- Deploying to the home server: [docs/deploy-home-server.md](docs/deploy-home-server.md)
- Design mockup: [design/client-portal-mockup.dc.html](design/client-portal-mockup.dc.html)
- MCP endpoint for AI clients: [docs/mcp.md](docs/mcp.md)
- Adding a client and checking it with **View as client**: [docs/adding-a-client.md](docs/adding-a-client.md)
- Analytics, monthly reports and the rankings forecast: [docs/analytics.md](docs/analytics.md)
- Live updates and the LMS Dash sync: [docs/live-updates-and-dash-sync.md](docs/live-updates-and-dash-sync.md)

## Status

**Live** at https://portal.londonmarketingsolutions.ca. **Phase 1 (built):** agency admin + client portal with monthly updates, work log, requests (with comments and approvals), messages, files (with approvals), and invoices. Clients sign up themselves with email + password through the agency's sign-up link; an admin approves each one. No email sending yet.

**Results (built 2026-11-03):** monthly reports from the client's own site analytics (refreshed hourly), Google rankings and AI answer checks pushed from LMS Dash, a three-month rankings forecast, a To-dos page with step-by-step instructions, a Brand kit page (business card, logos), and a Billing page with the current balance. Pages update live over server-sent events driven by Postgres `NOTIFY`, and ticket activity is pushed to LMS Dash by webhook.

Next: housekeeping and email. See [ROADMAP.md](ROADMAP.md).

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Postgres 16 via Drizzle ORM · Cloudflare R2 for files (local folder in development) · Vitest.

Runs on a single small server: one Node process, the existing Postgres, no Docker. Client files live in R2, off the server.

## How it's organised

```
src/db/schema.ts        tables (every row carries agency_id; client rows carry client_id)
src/lib/data/           all reads/writes, scoped to the logged-in viewer (tenant isolation lives here)
src/lib/auth/           password hashing (scrypt), sessions, role guards, API tokens
src/lib/mcp/            MCP server: protocol + tools over src/lib/data
src/lib/stats/          hourly fetch of each client site's visit counts
src/lib/live/           one LISTEN connection, fan-out to /api/live (SSE)
src/lib/reports.ts      report numbers (pure);  src/lib/forecast.ts  rankings forecast (pure)
src/lib/webhook.ts      signed ticket events to LMS Dash
src/app/api/mcp/        MCP endpoint (bearer token auth)
src/app/actions.ts      server actions shared by both sides
src/app/portal/         client portal
src/app/admin/          agency admin
src/components/         UI kit + shared feature components
tests/                  isolation + auth tests against a real Postgres
```

## Local development

Needs Node 20+ and Postgres 16.

```bash
cp .env.example .env               # set DATABASE_URL, COOKIE_SECURE=false for localhost
createdb lms_portal                # or create the role/db however you like
npm install
npm run db:migrate
npm run seed:demo                  # admin@demo.test / client@demo.test, password demo-password
npm run dev                        # sign-up link: Admin → Sign-ups
```

First real admin (prints a one-time link to set the password):

```bash
npm run create-admin -- "Agency name" "Your name" you@example.com
```

Checks:

```bash
npm run typecheck && npm run lint && npm test   # tests use the lms_portal_test DB (TEST_DATABASE_URL)
npm run build
```

Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
