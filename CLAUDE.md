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
