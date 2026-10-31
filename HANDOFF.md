# Handoff

## State (2026-10-31)

- Live at https://portal.londonmarketingsolutions.ca, running `main` on luccaserver
  (`/srv/apps/lms-portal`, systemd `lms-portal`, 127.0.0.1:3010). Deploy steps: docs/deploy-home-server.md.
- Admin account: lucca.marketingsolutions@gmail.com.
- MCP endpoint `/api/mcp` with admin API tokens (docs/mcp.md) is live since 2026-10-31 (0ec13ef).
  Claude Code on lucca-mainpc has it as user-scope MCP server `lms-portal`, token label
  "Claude Code (lucca-mainpc)". Lost or leaked token: revoke it on the server and add a new one.
- The live portal has no clients yet.

## Next

- Housekeeping and email from ROADMAP.md.
- 8 old commits carry AI-authorship trailers (repo_hygiene.py blocker). Removing them needs a
  history rewrite + force push; left alone until Lucca decides.

## Gotchas

- No Postgres on lucca-mainpc. Tests run against a throwaway one: `npx embedded-postgres`
  (npm package `embedded-postgres`, Postgres 16) started from a scratch folder, then
  `TEST_DATABASE_URL=postgres://lms_portal:devpass@127.0.0.1:<port>/lms_portal_test npm test`.
  PGlite does not work: it is single-connection, so transactions deadlock the pool.
- `/srv/apps/lms-portal/src` on the server is not a git checkout; code goes up as a `git archive` of main.
