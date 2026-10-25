# lms-portal

Client portal for web and marketing agencies. Clients log in to see monthly updates, the work done for them, their website's leads, results and health, and to send requests, messages and files and view invoices, all in one place instead of PDFs and email.

Built first for our own clients, designed multi-tenant so it can be sold to other agencies.

- Product spec: [docs/spec.md](docs/spec.md)
- Deploying to the home server: [docs/deploy-home-server.md](docs/deploy-home-server.md)
- Design mockup: [design/client-portal-mockup.dc.html](design/client-portal-mockup.dc.html)

## Status

**Phase 1 (built):** agency admin + client portal with monthly updates, work log, requests (with comments and approvals), messages, files (with approvals), and invoices. Password login with invite links (no email sending).

**Phase 2 (later):** leads inbox from client website forms, performance/analytics, site health.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Postgres 16 via Drizzle ORM · files on local disk · Vitest.

Runs on a single small server: one Node process, the existing Postgres, no Docker.

## How it's organised

```
src/db/schema.ts        tables (every row carries agency_id; client rows carry client_id)
src/lib/data/           all reads/writes, scoped to the logged-in viewer (tenant isolation lives here)
src/lib/auth/           password hashing (scrypt), sessions, role guards
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
npm run dev
```

First real admin (prints an invite link to set the password):

```bash
npm run create-admin -- "Agency name" "Your name" you@example.com
```

Checks:

```bash
npm run typecheck && npm run lint && npm test   # tests use the lms_portal_test DB (TEST_DATABASE_URL)
npm run build
```

Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
