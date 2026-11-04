# lms-portal

London Marketing Solutions client portal. Next.js 15 (App Router, server actions), TypeScript,
Tailwind 4, Postgres 16 via Drizzle, R2 for files, Vitest. Live at
https://portal.londonmarketingsolutions.ca. Start with HANDOFF.md, then README.md.

## Rules

- All reads/writes go through `src/lib/data/*`, scoped by the `Viewer`. Tenant isolation lives
  there; pages, server actions and MCP tools never query the db for client data themselves.
- MCP tools (`src/lib/mcp/tools.ts`) call the same data functions as the admin pages. New admin
  feature = data function + page/action + MCP tool + test in `tests/`.
- Messages, comments, files and non-draft invoices are visible to the client. Confirm wording with
  Lucca before sending anything through the `lms-portal` MCP server.
- Adding a client: docs/adding-a-client.md (MCP: `new_client_guide`). Check it with
  **View as client** before telling the client it's ready.
- Schema change: edit `src/db/schema.ts`, `npm run db:generate`, commit the file in `drizzle/`.
- Deploying to luccaserver changes production: docs/deploy-home-server.md, and ask Lucca first.

## Checks

`npm run typecheck && npm run lint && npm test`, then `npm run build` (needs `DATABASE_URL` set).
Tests need a real Postgres: see the Gotchas in HANDOFF.md for the embedded-postgres setup.

## Gotchas

- "View as client" is a second cookie (`lms_preview`) read only by `requireClient()`. Server
  actions still use the real admin viewer; the portal wraps preview pages in a disabled fieldset.
- `.claude/` is gitignored; never commit it.
- Live updates: Postgres triggers (`drizzle/0004_live_notify.sql`) NOTIFY on every client table; a new
  client-visible table needs adding to that trigger list (new migration) or its pages won't refresh live.
- `clients.stats_token` is secret: `getClient`/`listClients` select explicit columns without it. Keep it that way.
- `src/instrumentation.ts` only imports `instrumentation-node.ts` under `NEXT_RUNTIME === "nodejs"`;
  importing db code directly there breaks the Edge build (`Can't resolve 'fs'`).
- Bash heredocs with long inline Python sometimes fail to parse ("unexpected EOF"); write the script to the
  scratchpad and run it instead.
- Performance notes and how to measure: docs/performance.md. Reads a layout and its page both make are
  wrapped in React `cache()` in `src/lib/data`; keep new shared reads wrapped too.
- A new long-lived response (another SSE route) must register with `trackStream` (`src/lib/live/hub.ts`)
  or restarts hang until systemd's 90 s stop timeout.
- LMS Dash is the source for rankings, AI answers and invoices; it pushes them here. Don't edit those
  by hand in the portal or the next Dash sync overwrites them. docs/live-updates-and-dash-sync.md.
- `src/kit/` is a copy of LMS Dash's `app/static/kit/`. Never edit it here: change it in lms-dash and run its `scripts/sync_kit.py`. Kit classes start with `k-`.
- `src/lib/auth/session.ts` imports `server-only`, so tests can't import it; pure helpers (homePath, dashUrl) live in `src/lib/auth/home.ts`.
- `next build` fails with "Unexpected end of JSON input" while `next dev` is running in the same folder (shared `.next`). Stop dev first.
