# Performance

How fast the client portal and LMS Dash are, what was measured, what was changed and why, and what
was left alone. Performance only (load time, server time, query cost, memory, bandwidth), not SEO.
First pass: 2026-11-04.

## Where the time goes

A page view crosses: browser, Cloudflare edge, the tunnel (`cloudflared-lms` for the portal, `pawsit`
for Dash), nginx on luccaserver, then the app. From outside, a public page answers in about 160 to
190 ms; the app's own share of that is 3 to 30 ms. Most of what a visitor waits for is the trip to the
home server, which no code change here can shorten. The work below goes after the parts that are ours:
time spent in the app, work repeated per request, and the occasional slow request that is ten or a
hundred times the normal one.

## Findings

### Client portal (Next.js 15, Postgres 16, Drizzle)

- **Data is tiny.** The largest table has 16 rows; `site_stats` for Maple is one 701-byte JSONB value
  with 49 rows. `EXPLAIN (ANALYZE, BUFFERS)` on the hot queries (session lookup, request, file and
  to-do lists, site stats, rankings, the Dash resync query) shows every one executing in under 0.1 ms,
  entirely from shared buffers. Planning (0.1 to 0.6 ms) costs more than execution. At this size
  Postgres is right to seq-scan, and new indexes would change nothing. Summarising `site_stats.rows`
  in JS on each report view is likewise negligible.
- **Duplicate queries per request.** Layouts and pages each fetched the same things: the portal
  layout loads the agency, client, requests, files and open to-do count for the nav, and Home loads
  most of them again. Every data function also re-ran the client ownership check
  (`resolveClientId`). Home ran 18 statements; the admin client page ran the same ownership check
  five times (15 statements).
- **Connection setup on almost every page view.** node-postgres closes idle pool connections after
  10 s by default. A new connection (TCP plus SCRAM authentication) added about 20 ms on the server.
  On a site this quiet, clicks are usually more than 10 s apart, so most real page views paid it.
- **No pool error handler.** An idle connection dropped by Postgres (restart, admin kill) emits an
  `error` event on the pool; with no listener, Node treats it as uncaught and the service crashes and
  restarts.
- **Bug found on the way:** the request list's comment count rendered as
  `where "request_id" = "id"` (drizzle drops table names in a single-table select), so `id` bound to
  `request_comments.id` and the count was always 0. Fixed, with a test.
- **JS bundles are already small**: 103 kB shared first load (React and Next), each route adds
  0.1 to 2.3 kB. Hashed `/_next/static` files are served `public, max-age=31536000, immutable` and
  Cloudflare caches them at the edge (`cf-cache-status: HIT`).
- **Compression works end to end.** Next gzips at the origin; Cloudflare serves Brotli to browsers.
- **Memory:** the portal service uses about 70 MB (limit 400 MB), Postgres about 85 MB.
- **SSE live updates** cost one `LISTEN` connection per process and one open stream per open tab.
  Over HTTP/2 (which Cloudflare speaks to browsers) a stream does not use up the browser's
  per-host connection budget. Each change triggers one `router.refresh()`, which is now a cheaper
  render because of the dedupe below.
- **Restarts hung for 90 s.** On SIGTERM, Next stops accepting connections and waits for open ones to
  finish before exiting. An SSE stream never finishes, so with any portal page open a restart waited
  for systemd's stop timeout (90 s) and then a SIGKILL, with the portal unreachable meanwhile. The
  07:32 deploy on 2026-11-04 hit this.

### LMS Dash (FastAPI, SQLite, vanilla JS)

- **Warm API calls are fast**: 3 to 10 ms for every endpoint measured.
- **Home was slow every few minutes.** `/api/overview` builds each running client's progress from its
  GitHub README (cached 2 minutes) and its site stats from the client's own site (cached 10 minutes),
  and on a cache miss it waited for both. After the brief cache lapsed, Home took 0.67 to 0.96 s
  instead of 13 ms. Lucca and Evan open Dash on and off rather than continuously, so most Home loads
  hit a cold cache. The client page had the same problem.
- **Every write cost about 75 ms on the HDD.** `db.tx()` opens and closes a connection per
  transaction. With the default `synchronous=FULL`, each commit waits for an fsync of the WAL, and
  when the last connection to a WAL database closes, SQLite checkpoints the WAL into the database and
  deletes it, which is more disk syncs. Measured on a copy of `lms.db` on the server's disk:

  | Setting | Whole write transaction (median) |
  |---|---|
  | as it was (FULL, connection per transaction) | 75.3 ms |
  | one idle connection held open, FULL | 25.0 ms |
  | NORMAL, connection per transaction | 74.9 ms |
  | one idle connection held open, NORMAL | 1.7 ms |

  Opening a connection and running one query costs 0.56 ms; the same query on an open connection
  costs 0.004 ms. That difference was not worth a connection pool at Dash's traffic.
- **No compression at the origin.** JSON left the server raw (29 KB overview, 43 KB client page) and
  crossed the tunnel uncompressed; Cloudflare only compressed it on the last leg.
- **Static files**: the app sends `Cache-Control: no-cache` for `/static/*`, but the pawsit zone's
  Browser Cache TTL rewrites it to `max-age=14400` (4 hours). Files are versioned with `?v=N`.

## What changed

### Client portal

| Change | Where | Why |
|---|---|---|
| React `cache()` on reads that layouts and pages share: `resolveClientId`, `getAgency`, `getClient`, `listClients`, `listRequests`, `listAgencyOpenRequests`, `listFiles`, `countOpenTodos`, `listPendingSignups` | `src/lib/data/*` | Each runs once per render. The cache lives for one server render; server actions and the MCP endpoint call straight through |
| Pool keeps idle connections 10 minutes (was 10 s) | `src/db/index.ts` | Removes the ~20 ms connection setup from most page views |
| `pool.on("error")` logs instead of crashing | `src/db/index.ts` | A dropped idle connection no longer takes the service down |
| Site stats and the client's stats URL in one joined query | `src/lib/data/stats.ts` | One round trip instead of two on Home and Monthly reports |
| Admin client header loads client, requests and to-do count in parallel | `src/app/admin/clients/[id]/layout.tsx` | Removes a sequential wait |
| Comment count subquery qualified | `src/lib/data/requests.ts` | Correctness (see above) |
| Open `/api/live` streams are closed on SIGTERM and SIGINT | `src/lib/live/hub.ts` (`trackStream`, `closeAllStreams`), `src/instrumentation-node.ts` | Restarts finish in under a second; browsers reconnect to the new process (`retry: 5000`) |

### LMS Dash

| Change | Where | Why |
|---|---|---|
| Stale-while-revalidate for briefs and site stats on Home and the client page | `app/briefs.py` (`cached`), `app/growth.py` (`fetch_stats(stale_ok=True)`) | A copy past its TTL is returned at once and refreshed in a background thread. Only the first load after a restart waits for GitHub. Edits still use `get(refresh=True)` |
| One idle connection held open for the process | `app/db.py` (`_hold_open`) | Closing a request's connection no longer checkpoints and deletes the WAL. It reads once (`PRAGMA schema_version`, to the end) when opened: a connection that has never read doesn't map the WAL index and doesn't count. The first deploy missed this; `test_wal_survives_a_request_closing_its_connection` covers it |
| `PRAGMA synchronous=NORMAL` | `app/db.py` (`connect`) | Commits no longer wait for an fsync. Trade-off below |
| `GZipMiddleware(minimum_size=1000, compresslevel=6)` | `app/main.py` | JSON, HTML, JS and CSS cross the tunnel compressed. Starlette skips images and SSE |

**synchronous=NORMAL trade-off.** In WAL mode the database stays consistent after a crash or power
cut, but the last few commits before a power cut (not an app crash) can be lost; they are synced at
the next checkpoint. For an internal dashboard on a home server that is backed up before every
deploy, a write that takes 2 ms instead of 25 ms is worth that. To undo it, delete the one PRAGMA line
in `app/db.py`; the held-open connection alone still gives 75 ms to 25 ms.

## Before and after

Server-side times are medians of 15 requests made on luccaserver straight to the app
(127.0.0.1), so they leave out Cloudflare and the tunnel. Portal client pages were measured through
View as client, which adds two lookups a real client doesn't make. Query counts are statements per
page view, counted with `log_statement=all` on a throwaway Postgres running the same build.

### Client portal

| Measure | Before | After |
|---|---|---|
| Home, statements per page view | 18 | 13 |
| Monthly reports / Rankings / Requests | 13 / 9 / 9 | 12 / 9 / 8 |
| Billing / To-dos / Files / Messages | 11 / 9 / 9 / 10 | 9 / 9 / 9 / 9 |
| Admin client page / its Billing tab | 15 / 13 | 10 / 9 |
| Admin clients list / request inbox | 6 / 6 | 5 / 5 |
| Home, first request after 15 s idle | 35 to 45 ms | 28 ms |
| Home, warm | 22.2 ms | 21.4 ms |
| Monthly reports / Rankings, warm | 25.0 / 31.2 ms | 25.8 / 31.6 ms |
| Restart with a live page open | 90 s, portal unreachable (07:32 deploy) | 0.8 s |
| JS first load | 103 kB | 103 kB |
| Memory: portal / Postgres | 69 / 85 MB | 74 / 100 MB |

Warm server time barely moved: rendering dominates, and the removed queries ran in parallel with
others. The gain is in the first request after a pause, which is most real page views here, and in
restarts. Postgres uses about 15 MB more while the pool's idle connections are kept (up to 5, closed
after 10 idle minutes). Admin pages now redirect to LMS Dash in production (`ADMIN_HOME_URL`), so
their query counts come from the local build.

### LMS Dash

| Measure | Before | After |
|---|---|---|
| Home (`/api/overview`) after the brief cache lapses | 0.67 to 0.96 s | 12 to 16 ms |
| Home, warm | 10.1 ms | 9.4 to 10.1 ms |
| Write transaction on the server's disk | 75 ms (copy of `lms.db`) | 2.0 ms (live `lms.db`) |
| Bytes over the tunnel: Home / client page | 29.3 / 43.3 KB | 5.9 / 8.8 KB |
| Bytes over the tunnel: invoices / progress / `index.html` | 25.6 / 32.6 / 6.0 KB | 4.9 / 7.7 / 1.9 KB |
| Other endpoints, warm | 2.7 to 8.7 ms | 2.5 to 8.8 ms |
| Memory | 85 MB | 89 MB |

While the service runs, `data/` now keeps `lms.db-wal` and `lms.db-shm` next to `lms.db`. That is
the held-open connection working; before, the WAL was deleted after every request.

## Not changed, and why

- **Indexes.** Nothing to gain at this size (see EXPLAIN above). Worth a look once a table passes a
  few thousand rows: `requests (agency_id, updated_at)` would serve the admin inbox and the Dash
  resync (`list_request_activity`).
- **`pg_stat_statements`.** Available but not loaded. Turning it on means adding it to
  `shared_preload_libraries` and restarting Postgres, which also restarts PawSit's database. Needs
  Lucca's OK; with the query counts above it isn't needed yet.
- **Named prepared statements** (drizzle `.prepare("name")`) would skip the 0.1 to 0.6 ms of planning
  per query. Not worth the extra code at current traffic.
- **nginx gzip / static serving.** nginx's `gzip_proxied` is off and `gzip_types` is the default, but
  both apps now compress themselves and Cloudflare caches the portal's hashed assets at the edge.
  Changing nginx would need Lucca's OK and would save almost nothing.
- **Dash static files with a one-year `immutable` cache.** Cloudflare already gives browsers 4 hours.
  Going further is only safe if file versions are content hashes, not the hand-bumped `?v=N`,
  otherwise a forgotten bump leaves browsers on old JS for a year.
- **Rankings page HTML** is 105 KB (22 KB compressed) because each forecast chart is server-rendered
  SVG that also appears in the RSC payload. Shipping the data and drawing charts in the browser would
  shrink it but add client JS; at 22 KB on the wire it isn't worth it.
- **`loading.tsx` skeletons** would make navigation feel instant (Next can then prefetch the layout),
  but that is a design decision as much as a performance one.
- **Expired portal sessions** are never deleted. The table is tiny and the lookup is by primary key,
  so it doesn't affect speed; a cleanup in the hourly job would be tidy housekeeping.

## How to measure again

- Portal pages: a temporary admin session row in `sessions` (sha256 of a random token, 3-hour
  expiry), then `curl -b "lms_session=<token>; lms_preview=<client id>"` against
  `http://127.0.0.1:3010` on the server; delete the row afterwards. The scripts used for this pass
  ran from the server's home folder and were removed.
- After-idle cost: wait 15 s between requests (longer than the old pool idle timeout).
- Query counts: start Postgres with `-c log_statement=all`, run the production build against it, and
  count `execute` lines per request.
- Dash: a temporary row in Dash's `sessions` table, then `curl -b "lms_session=<token>"` against
  `http://127.0.0.1:9141`. For the cold-cache case, wait longer than the brief TTL (120 s) between
  requests.

## Sources

- Next.js, [Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components): ORM and database calls are not memoized like `fetch`; wrap them in React `cache()` to dedupe within a render.
- Next.js, [`compress`](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress): Next gzips responses by default when self-hosted; turn it off only when a proxy compresses instead.
- node-postgres, [Pool API](https://node-postgres.com/apis/pool) and the `pg-pool` source (3.14, `idleTimeoutMillis` defaults to 10000; 0 disables idle closing; an `error` listener is required for idle client errors).
- Drizzle, [Query performance](https://orm.drizzle.team/docs/performance): prepared statements reuse the built SQL and the server-side plan.
- PostgreSQL, [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html): how the planner chooses between sequential and index scans by estimated cost.
- Cybertec, [Seq Scan](https://pgconfigurator.cybertec-postgresql.com/docs/plan-nodes/seq-scan): sequential scans are the right plan for small tables.
- SQLite, [Write-Ahead Logging](https://www.sqlite.org/wal.html): the WAL is checkpointed and deleted when the last connection closes; readers and writers don't block each other.
- SQLite, [PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous): NORMAL in WAL mode is consistent and durable except for the most recent commits on power loss.
- better-sqlite3, [Performance](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/performance.md): WAL plus `synchronous=NORMAL` as the usual setting for web apps.
- Cloudflare, [Content compression](https://developers.cloudflare.com/speed/optimization/content/brotli/content-compression/): Cloudflare asks the origin for gzip or Brotli and compresses for visitors on its own.
- Starlette, [GZipMiddleware](https://www.starlette.io/middleware/#gzipmiddleware): `minimum_size`, `compresslevel`, and content types it skips.
- MDN, [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource): the per-host connection limit applies to SSE over HTTP/1.1, not HTTP/2.
- Simon Hearne, [Caching header best practices](https://simonhearne.com/2022/caching-header-best-practices/): one-year `immutable` caching only for versioned (hashed) files.
- RFC 5861, [HTTP Cache-Control Extensions for Stale Content](https://www.rfc-editor.org/rfc/rfc5861): the stale-while-revalidate pattern used for Dash's caches.
