# Handoff

## State (2026-10-31)

- Live at https://portal.londonmarketingsolutions.ca, running `main` on luccaserver
  (`/srv/apps/lms-portal`, systemd `lms-portal`, 127.0.0.1:3010). Deploy steps: docs/deploy-home-server.md.
- Admin account: lucca.marketingsolutions@gmail.com.
- MCP endpoint `/api/mcp` with admin API tokens (docs/mcp.md) is live since 2026-10-31 (0ec13ef).
  Claude Code on lucca-mainpc has it as user-scope MCP server `lms-portal`, token label
  "Claude Code (lucca-mainpc)". Lost or leaked token: revoke it on the server and add a new one.
- Clients: **Maple Rental** (id `69943bce-49ad-4e43-97d0-9d24bc997d20`, created 2026-10-31 over MCP).
  Nobody has joined it yet: send Maple the sign-up link and approve them into that client.
- **View as client** (2026-10-31): admin button on each client page opens `/portal` as that client's
  first user, read-only, with a banner and Exit preview. Settings has one per person. How to add a
  client: docs/adding-a-client.md (also the MCP tool `new_client_guide`).

## Next

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
