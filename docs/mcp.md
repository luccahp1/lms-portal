# MCP endpoint

The portal is also an MCP server, so an AI client such as Claude Code can do anything an agency
admin can do in the admin pages: read and write monthly updates and the work log, handle requests,
message clients, upload and read files, manage invoices, and approve sign-ups.

- URL: `https://portal.londonmarketingsolutions.ca/api/mcp`
- Transport: Streamable HTTP, stateless (one JSON-RPC message per POST, JSON reply, no sessions)
- Auth: `Authorization: Bearer lmsp_...`, a token tied to one agency admin

## How it works

`src/app/api/mcp/route.ts` checks the token and hands the message to `src/lib/mcp/protocol.ts`,
which implements `initialize`, `ping`, `tools/list` and `tools/call`. The tools in
`src/lib/mcp/tools.ts` call the same `src/lib/data` functions as the admin pages, so tenant
isolation, role checks and validation work the same way as in the UI. A token only works while
its owner is an active `agency_admin`, and it can only reach that admin's agency.

Tools that change data refresh the portal's pages afterwards. Tools are annotated `readOnlyHint`
or `destructiveHint` so clients can ask before deleting.

## Tools added for results and LMS Dash (2026-11-03)

| Tool | Does |
|---|---|
| `create_client_user` | Login for a client without the sign-up step; returns a set-password link |
| `set_stats_source`, `get_site_stats` | Connect a client site's analytics; read the stored copy |
| `sync_rankings`, `list_rankings` | Replace / read tracked Google searches and monthly positions |
| `sync_ai_answers` | Replace the AI answer checks |
| `upsert_invoice` | Create or update an invoice by number |
| `set_payment_instructions` | How clients pay, shown on Billing |
| `list_request_activity` | Requests changed since a time, with comments (Dash resync) |
| `delete_request` | Remove a test or spam ticket |
| `list_todos`, `save_todo`, `set_todo_status`, `delete_todo` | The client's To-dos |
| `upload_file` `folder: "brand"` | File into the client's Brand kit |

How LMS Dash uses them: [live-updates-and-dash-sync.md](live-updates-and-dash-sync.md).

## Onboarding clients

`new_client_guide` returns the onboarding steps in order with the live sign-up link, and the
server's `instructions` tell clients to call it first. `get_overview`, `get_client` and
`create_client` include a `previewUrl` per client: the **View as client** page, which works in a
browser logged in as an admin. Full walkthrough: [adding-a-client.md](adding-a-client.md).

## Tokens

Run these on the server from `/srv/apps/lms-portal/src` (they read `.env`). Live since 2026-10-31; Claude Code on lucca-mainpc is connected as `lms-portal`.


```bash
npm run api-token -- create you@example.com "Claude Code"   # prints the token once
npm run api-token -- list you@example.com
npm run api-token -- revoke you@example.com "Claude Code"   # omit the label to revoke all
```

Only the sha256 of a token is stored (`api_tokens` table). A lost token can't be recovered:
revoke it and create a new one.

## Connecting Claude Code

```bash
claude mcp add --transport http --scope user lms-portal https://portal.londonmarketingsolutions.ca/api/mcp --header "Authorization: Bearer lmsp_..."
```

## Adding a tool

Add an entry to `tools` in `src/lib/mcp/tools.ts` with a zod input schema and a `run` that calls a
data-layer function. Mark it `readOnly` or `destructive` as appropriate, and cover it in
`tests/mcp.test.ts`.
