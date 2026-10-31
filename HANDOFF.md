# Handoff

## State (2026-10-31)

- Live at https://portal.londonmarketingsolutions.ca, running `main` on luccaserver
  (`/srv/apps/lms-portal`, systemd `lms-portal`, 127.0.0.1:3010). Deploy steps: docs/deploy-home-server.md.
- Admin account: lucca.marketingsolutions@gmail.com.
- New: MCP endpoint at `/api/mcp` with admin API tokens (docs/mcp.md). Built and tested locally
  (35 tests, plus an end-to-end run with the MCP Inspector against a local build). Needs deploy +
  `npm run db:migrate` (migration 0002_api_tokens) before it works in production.

## Next

- Deploy the MCP endpoint, create a token, register it in Claude Code.
- Housekeeping and email from ROADMAP.md.

## Gotchas

- No Postgres on lucca-mainpc. Tests run against a throwaway one: `npx embedded-postgres`
  (npm package `embedded-postgres`, Postgres 16) started from a scratch folder, then
  `TEST_DATABASE_URL=postgres://lms_portal:devpass@127.0.0.1:<port>/lms_portal_test npm test`.
  PGlite does not work: it is single-connection, so transactions deadlock the pool.
- `/srv/apps/lms-portal/src` on the server is not a git checkout; code goes up as a `git archive` of main.
