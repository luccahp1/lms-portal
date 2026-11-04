# Handoff

## State (2026-11-04, later): agency side moved to LMS Dash

- The admin pages now live in LMS Dash (https://lms-dev.pawsit.ca): each client's **Portal** tab and a
  **Sign-ups** page. `/admin` here redirects to `ADMIN_HOME_URL` (set in the server .env). Unset it to
  bring the old admin pages back. Deployed 07f237b with Dash 0ec6b6e; backups `*20261104-072841*`.
- View as client from Dash: `create_preview_link`, then `/preview/<token>`: one use, 2 minutes,
  opening a read-only one-hour preview of that one client (tables `preview_links`, `preview_sessions`).
- Restarting `lms-portal` takes about 90 s: Node waits for open `/api/live` streams. Fix: `TimeoutStopSec=10`
  in the unit (needs Lucca's OK) or close streams on SIGTERM.

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
- One login for Dash and the portal (ROADMAP decision).
- Performance pass on the site and database (separate session).
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
- R2 uploads must go out with a known length: sign with aws4fetch, then send with plain `fetch`
  (`src/lib/storage.ts`). aws4fetch's own fetch sends chunked and R2 answers 411.
