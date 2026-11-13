# Handoff

## State (2026-11-11, merged 2026-11-13): onboarding, templates and Request website changes

Merged into `main` from `claude/loving-babbage-u1e3ts` (PR #2) with the matching lms-dash branch. Docs: docs/adding-a-client.md, docs/website-changes.md; lms-dash docs/onboarding.md.

- Migrations `0010_onboarding_and_change_notes` and `0011_live_notify_onboarding` (renumbered after
  `0009_payments` at the merge; same SQL) (new tables
  `start_links`, `intakes`, `change_notes`; `clients.review_url`, `clients.stage`; the notify
  trigger now covers them and `clients`).
- Deploy this before Dash. `REVIEW_SECRET=<long random string>` belongs in the server `.env`
  (without it each process makes its own, so review links stop working after a restart)
  (`python -c "import secrets; print(secrets.token_urlsafe(48))"`). Do not set `REVIEW_ALLOW_PRIVATE`.
- `skipTrailingSlashRedirect` is on in `next.config.ts` (the review frame needs it); `/portal/`
  and `/portal` both still work.
- Checks: typecheck, lint (the one old warning), 100 tests, build (shared first load still 103 kB).
  Walked end to end with Dash locally in Chromium at 1440 and 390 px.
- Before showing clients: the ten designs use drawn photo slots, not photographs, and their sample
  wording and prices are placeholders. Check `/site/...` against Maple's real site once deployed
  (fonts, the quote form staying switched off, visit counts not moving).
- Existing clients see one new thing: the **Request website changes** button, because they have a
  website address. No project card (their stage is empty).
## State (2026-11-13): payments, part-paid invoices, billing FAQ (deployed 2a8a843; onboarding merge 3fbc1cd deployed 23:00 UTC)

LMS Dash now records payments and works out how much of each invoice they cover; the portal shows
the result. Dash is the source: nothing here changes a payment.

- **Migration `0009_payments`**: `payments` table (with the live-update trigger), `invoices.paid_cents`,
  `clients.monthly_cents` and `clients.credit_cents`.
- **`sync_payments` MCP tool** (`src/lib/data/payments.ts`): replaces a client's payments by Dash's
  ref, keeping `seen_at` so a dismissed notice stays dismissed. `upsert_invoice` takes `paidCents`.
- **`balance()`** (`src/lib/data/invoices.ts`) counts only the unpaid part of a sent invoice and
  returns the open list for "Owed for". Billing rules (1st / 16th / 2% after 30 days) are in
  `src/lib/billing.ts`.
- **Client UI**: "Payment received" notice on every portal page until dismissed
  (`PaymentNotice`, `dismissPaymentsAction`; an admin preview never clears it). Billing page moved to
  the kit: balance card (owed for, paid, monthly with next invoice and due date, credit, late-fee
  flag), payments list, invoices with "Part paid", and the billing FAQ at the bottom. The FAQ text is
  `src/kit/billing-faq.json`, synced from lms-dash `app/static/kit` like the rest of the kit.
- Checks: typecheck, lint (the one old warning), 92 tests, build. Tried end to end against a local
  Dash: a $1,000 payment showed the notice and the new balance live; a removed payment rolled back.
- **To deploy** (before or with Dash; ask Lucca first): back up the database, archive `main`,
  `npm ci && npm run build && npm run db:migrate`, rebuild `../current`, restart `lms-portal`.
  Then reconnect the Claude Code `lms-portal` MCP client so it lists `sync_payments`.

## Deployed 2026-11-13: 5446a53

Sign-in limit and `delete_invoice` (below) are live. No migration (still 0000 to 0008).
- Backups: `/srv/backups/lms-portal/{src.tgz,current/,env.bak,lms_portal.dump}` named `*.20261113-111823.pre-audit`.
- Checked: `/login` 200 local and public; the 11th wrong try from one browser shows "Too many tries";
  a wrong try from another address still gets the normal "don't match"; MCP `tools/list` has 52
  tools including `delete_invoice`. A correct sign-in was not tried (no test account).
- Rollback: `rm -rf current && cp -a /srv/backups/lms-portal/current.20261113-111823.pre-audit current`,
  then restart `lms-portal`.

## State (2026-11-12, later): sign-in limit and delete_invoice

From the cross-repo audit (`lms-dash/docs/SYSTEM-AUDIT.md`). Two changes on `main`, neither on the
server yet. No migration in either.

- **Sign-in limits wrong tries** (50d7c0d). The sign-in page is public and opens both the portal and
  LMS Dash, and it took unlimited password guesses. `src/lib/auth/login.ts` counts wrong tries in
  memory for 15 minutes: 10 per address, 30 per email. The address is `cf-connecting-ip` (set by
  Cloudflare, not the browser), then the last hop of `x-forwarded-for`. An unknown email is checked
  against a throwaway hash, so it is refused as slowly as a wrong password. `checkCredentials` in
  `session.ts` is gone; `attemptLogin` replaces it and is testable (no `server-only`).
  `tests/login.test.ts`.
- **`delete_invoice` MCP tool** (4236118), `deleteInvoiceByNumber` in `src/lib/data/invoices.ts`.
  Removes one client's invoice by number. LMS Dash calls it when an invoice is deleted, renumbered,
  moved to another client or turned into an estimate there; before, the old copy stayed on the
  client's Billing page and in what they owe. Dash falls back to hiding the invoice as a draft
  while the portal does not have the tool, so the two can be deployed in either order.
  `tests/sync.test.ts`.
- Checks: typecheck, lint (the one old warning), 89 tests against embedded Postgres 16, build.
- **To deploy** (docs/deploy-home-server.md, ask Lucca first): archive `main`, `npm ci && npm run
  build`, rebuild `../current`, restart `lms-portal`. `npm run db:migrate` has nothing to apply.
  After it, check a wrong password ten times from one browser gets "Too many tries", and that the
  Claude Code `lms-portal` MCP client is reconnected so it lists `delete_invoice`.
- Not done: the limit is per process and resets on restart; no lockout notice is sent to anyone.

## State (2026-11-12): job dashboard link and one-click sign-in into it

luccahp1/lms-portal#3 merged. A client whose company has the job dashboard (mikedash, one installation
per company) gets **Open your dashboard** in the side menu.

- `clients.dashboard_url` (migration 0007), set by an admin (client Settings, MCP `set_client_dashboard`,
  or Dash's Job dashboard box). Plain `https://` only.
- **One-click sign-in** (migration 0008, `dashboard_sso_links` + `clients.dashboard_sso_secret_hash`).
  `/sso/dashboard` makes a 2-minute, single-use token (sha256 stored, bound to the client) and sends the
  browser to `<dashboard>/dashboard/sso?t=`. The dashboard redeems it at `POST /api/dashboard-sso/redeem`
  with its own secret (Bearer). One 401 for every failure; the token burns on the first try. Admins in
  View as client and clients without a secret get the plain address. MCP `set_client_dashboard_sign_in
  {clientId, enabled}` makes (shows once) or removes the secret. docs/sso.md, "Into a client's job dashboard".
- Tests: 81 pass against embedded Postgres 16 (`tests/dashboard-sso.test.ts` is new). Lint: no new
  warnings (the one in `tests/dash-admin.test.ts` is old).
- Checked in a browser against a local portal and a local mikedash: client signs in to the portal,
  Open your dashboard lands signed in; a bad token lands on the dashboard's login with a note; the
  admin form shows and saves the address.
- **Deployed 2026-11-12** (f40374b, migrations 0007 and 0008 applied). Backups: `/srv/backups/lms-portal/*.20261112-181651.pre-dashboard-sso*`.

## State (2026-11-05, latest): same look and one login with LMS Dash, deployed

Deployed f28fb93 (migration `0006_sso_links` applied). Backups first:
`/srv/backups/lms-portal/src.20261105-031032.pre-one-workspace.tgz`, `current.20261105-031032.pre-one-workspace/`,
`env.20261105-031032.pre-one-workspace.bak`, `lms_portal.20261105-031032.pre-one-workspace.dump`.

- **Design kit** in `src/kit/` is a copy of LMS Dash's `app/static/kit/` (edit it there, run its
  `scripts/sync_kit.py`; `tests/sso.test.ts` checks they match). Tailwind's colours map onto the
  kit tokens in `src/app/globals.css`; light by default, dark via the band's toggle (`lms_look`
  cookie read in `src/app/layout.tsx`, no flash). Pieces: `src/components/kit.tsx`
  (KitCard, KitTile, KitHead, Count, Svg), `src/lib/charts.ts`, `src/components/KitClient.tsx`
  (motion on each page, theme toggle, phone drawer).
- **Shell** (`AppShell.tsx`, `NavLinks.tsx`) is Dash's: brand band, Live pill (follows the SSE
  stream), account chip, left nav. Nav names match Dash's client nav: Overview, To-dos, Monthly
  reports, Rankings, Requests, Messages, Files & approvals, Brand, Billing.
- **Overview** (`src/app/portal/page.tsx`) is the same section cards as the client Overview in
  Dash. Reports and Rankings use the kit tiles and charts.
- **One login** ([docs/sso.md](docs/sso.md)): one Sign in page, no role choice. Admins go on to
  Dash through `/sso/dash` (table `sso_links`, migration `0006_sso_links`, MCP tool
  `redeem_sso_link`) once `DASH_URL` is set; clients go to `/portal`. `/logout` (GET) is what
  Dash's sign out calls.
- Checks: typecheck, lint (one old warning in tests/dash-admin.test.ts), 71 tests, build (103 kB
  shared first load, unchanged). End to end with Dash locally, at 1440 and 375 px.
- Server `.env`: `DASH_URL` and `ADMIN_HOME_URL` are https://dash.londonmarketingsolutions.ca (Dash's
  new address on the `lms` tunnel; lms-dev.pawsit.ca is retired). Old files
  `env.20261105-031202.pre-dash-url.bak`, `env.20261105-032548.pre-dash-domain.bak`.
- Evan Koza has an `agency_admin` account (evankoza.marketingsolutions@gmail.com, LMS agency);
  the 14-day set-password link went to Lucca, nothing emailed.
- Checked on production over the public URLs with temporary session rows (deleted after): admin
  `/sso/dash` lands in Dash signed in, View as client from Dash opens `/portal`, a used token is
  refused, Dash's sign out ends the portal session, a client on `/sso/dash` goes to `/portal`.
- Rollback: unset `DASH_URL` and restart (admins land on `/admin`, which follows `ADMIN_HOME_URL`).

## State (2026-11-04, latest): performance pass

- Deployed 2d9d3fe + 088284c. Details, measurements and sources: docs/performance.md. Backups
  `/srv/backups/lms-portal/*20261104-074054.pre-perf*`.
- Reads shared by layouts and pages are wrapped in React `cache()` (Home 18 queries to 13). New
  layout/page reads that both call the same function should be wrapped the same way.
- The pg pool keeps idle connections 10 minutes (first request after a pause 35-45 ms to 28 ms) and
  logs idle connection errors instead of crashing.
- Restarts no longer hang 90 s: `/api/live` streams are closed on SIGTERM (0.8 s with a page open).
  No unit change was needed.
- Fixed: the request list comment count was always 0.
- Held back for Lucca: `pg_stat_statements` (needs a Postgres restart, which PawSit shares).

## State (2026-11-04, later): agency side moved to LMS Dash

- The admin pages now live in LMS Dash (https://dash.londonmarketingsolutions.ca, was lms-dev.pawsit.ca): each client's **Portal** tab and a
  **Sign-ups** page. `/admin` here redirects to `ADMIN_HOME_URL` (set in the server .env). Unset it to
  bring the old admin pages back. Deployed 07f237b with Dash 0ec6b6e; backups `*20261104-072841*`.
- View as client from Dash: `create_preview_link`, then `/preview/<token>`: one use, 2 minutes,
  opening a read-only one-hour preview of that one client (tables `preview_links`, `preview_sessions`).
- (Fixed in the performance pass: restarts used to take about 90 s while `/api/live` streams were open.)

## State (2026-11-04)

- **Results release live** (e3ae9d3, R2 upload fix c1dc47d): Monthly reports, Rankings forecast,
  Your to-dos, Your brand, Billing balance, live updates over SSE, LMS Dash sync. Docs:
  docs/analytics.md, docs/live-updates-and-dash-sync.md. Migrations 0003 + 0004 applied in production.
  Backups before deploy: `/srv/backups/lms-portal/*20261104-023404.pre-results*`.
- **Maple Rental is set up**: analytics connected to https://maplerental.ca/api/stats (hourly),
  14 tracked searches and 3 invoices pushed from LMS Dash, 3 to-dos (Google verification video,
  real trailer photos, customer logos), brand kit (business card front/back/PDF, two logos),
  payment instructions (e-Transfer). Login **office@maplerental.ca** created 2026-11-04 with a
  14-day set-password link given to Lucca; nothing emailed. Make a new link from client Settings if it lapses.
- **Invoices LMS-0002/3/4 are drafts** (copied from Dash), so Maple's balance shows $0 until they're
  marked sent in LMS Dash. Dash is the source; don't change them in the portal.
- Production checked end to end 2026-11-04: portal ticket → Dash webhook in under a second, Dash reply
  and status → portal, Dash push_all → rankings and invoices here. Test ticket deleted. Open item on
  the Dash side: it doesn't drop tickets deleted in the portal yet (`request.deleted`).
- Server `.env` has `LMS_DASH_WEBHOOK_URL` and `LMS_DASH_WEBHOOK_SECRET` (set by the Dash deploy).

## State (2026-10-31)

- Live at https://portal.londonmarketingsolutions.ca, running `main` on luccaserver
  (`/srv/apps/lms-portal`, systemd `lms-portal`, 127.0.0.1:3010). Deploy steps: docs/deploy-home-server.md.
- Admin account: lucca.marketingsolutions@gmail.com.
- MCP endpoint `/api/mcp` with admin API tokens (docs/mcp.md) is live since 2026-10-31 (0ec13ef).
  Claude Code on lucca-mainpc has it as user-scope MCP server `lms-portal`, token label
  "Claude Code (lucca-mainpc)". Lost or leaked token: revoke it on the server and add a new one.
- Clients: **Maple Rental** (id `69943bce-49ad-4e43-97d0-9d24bc997d20`, created 2026-10-31 over MCP).
  (Superseded 2026-11-04: login created directly, see above.)
- **View as client** (2026-10-31): admin button on each client page opens `/portal` as that client's
  first user, read-only, with a banner and Exit preview. Settings has one per person. How to add a
  client: docs/adding-a-client.md (also the MCP tool `new_client_guide`).

## Next

- Lucca: check Maple's to-dos with View as client, then send office@ the set-password link.
- Mark LMS-0002/3/4 sent in LMS Dash when they go out.
- Housekeeping and email from ROADMAP.md.
- 8 old commits carry AI-authorship trailers (repo_hygiene.py blocker). Removing them needs a
  history rewrite + force push; left alone until Lucca decides.

## Gotchas

- No Postgres on lucca-mainpc. Tests run against a throwaway one: `npx embedded-postgres`
  (npm package `embedded-postgres`, Postgres 16) started from a scratch folder, then
  `TEST_DATABASE_URL=postgres://lms_portal:devpass@127.0.0.1:<port>/lms_portal_test npm test`.
  PGlite does not work: it is single-connection, so transactions deadlock the pool.
- `npm run build` needs `DATABASE_URL` set (any value) or page-data collection fails.
- npm under Git Bash can fail from very long working paths; install throwaway packages from a short
  folder such as `C:\Users\lucca\pgtmp` (embedded-postgres 16.14.0-beta.17 is installed there).
- `/srv/apps/lms-portal/src` on the server is not a git checkout; code goes up as a `git archive` of main.
  Redeploy: scp the archive to ~, extract over src, `npm ci && npm run build && npm run db:migrate`,
  rebuild `../current` from `.next/standalone` + `.next/static` + `public`, `sudo systemctl restart lms-portal`.
- The `lms-portal` MCP client in Claude Code caches the tool list from when it connected; new tools need
  a reconnect (`/mcp`) before they show up.
- Wrapping a data function in React `cache()` dedupes it within one render only; server actions and
  `/api/mcp` call straight through, so a write followed by a read in an action is never stale.
- R2 uploads must go out with a known length: sign with aws4fetch, then send with plain `fetch`
  (`src/lib/storage.ts`). aws4fetch's own fetch sends chunked and R2 answers 411.
