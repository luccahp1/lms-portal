# Live updates and LMS Dash sync

## Live updates (no polling)

Pages stay current without asking the database every few seconds:

1. **Postgres triggers** (`drizzle/0004_live_notify.sql`) on every client-visible table send
   `NOTIFY portal_changes '<agency_id>:<client_id>'` on insert, update and delete. Postgres folds
   identical notifications within a transaction, so a bulk sync sends one.
2. **One `LISTEN` connection per server process** (`src/lib/live/hub.ts`) fans each notification out
   to subscribers. It reconnects on its own if Postgres restarts.
3. **`GET /api/live`** (server-sent events) streams a `change` event to an open page when something it
   can see changes. A client hears only its own client; an admin hears the whole agency. Bursts are
   collapsed into one event (400 ms), and a comment line every 25 s keeps proxies from closing it.
   `X-Accel-Buffering: no` stops nginx buffering the stream.
4. **`<LiveRefresh />`** (in the portal and admin layouts) opens the stream and calls
   `router.refresh()` on each event, and once more when the tab becomes visible again. If the stream
   fails three times in a row it falls back to a 60 s refresh while the tab is visible.

Because the triggers sit in the database, changes made anywhere (a page, the MCP endpoint, LMS Dash,
the hourly stats refresh) reach open pages the same way. This replaced the 15 s polling in Messages.

Cost: one idle Postgres connection per server process and one open HTTP stream per open tab.

## LMS Dash sync

LMS Dash (`luccahp1/lms-dash`) is where Lucca and Evan work; the portal is what clients see. They talk
over the portal's MCP endpoint (`docs/mcp.md`) with a dedicated admin API token labelled "LMS Dash",
and a webhook for ticket activity.

### Portal to Dash: tickets

- **Webhook**: on `request.created`, `request.updated` (status change or client approval),
  `request.commented` and `request.deleted`, the portal POSTs to `LMS_DASH_WEBHOOK_URL`:

  ```json
  { "event": "request.created", "clientId": "...", "clientName": "Maple Rental",
    "requestId": "...", "title": "...", "status": "received", "at": "2026-11-04T02:30:00.000Z" }
  ```

  with `X-LMS-Signature: sha256=<hex HMAC-SHA256 of the raw body, key LMS_DASH_WEBHOOK_SECRET>`.
  Fire and forget with a 3 s timeout (`src/lib/webhook.ts`): Dash being down never breaks a client.
- **Resync**: `list_request_activity { since }` returns every request changed after `since` with client
  name, details and the comment thread. Dash calls it on a slow timer so a missed webhook heals.
- **Replies from Dash**: `comment_on_request`, `set_request_status`, `create_request`.

### Dash to portal: results and billing

| Tool | What Dash sends |
|---|---|
| `sync_rankings` | The client's full set of tracked searches with positions per month (0 = not found) |
| `sync_ai_answers` | The AI answer checks: question, month, engine, `yes` / `cited` / `no` |
| `upsert_invoice` | An invoice by number. Drafts stay hidden; `sent` counts toward the balance |
| `upsert_monthly_note` | Optional: the report summary as the month's note |

### Environment (server `.env`)

```
LMS_DASH_WEBHOOK_URL=http://127.0.0.1:9141/api/portal/webhook
LMS_DASH_WEBHOOK_SECRET=<shared secret, also in lms-dash's env>
```

Leave both empty to switch the webhook off.
