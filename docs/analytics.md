# Results: analytics, reports, rankings forecast

What the client sees under **Monthly reports** and **Rankings forecast**, and where each number
comes from.

| Data | Source | How it gets here | Freshness |
|---|---|---|---|
| Visits, page views, calls, emails, quote requests, sources, pages | The client's own website (`GET <statsUrl>?from=&to=`, bearer token) | `src/lib/stats/refresh.ts` stores the rows in `site_stats` | Hourly, plus on demand when a page finds the copy older than an hour |
| Google positions per search and month | LMS Dash (typed in there) | Dash calls the `sync_rankings` MCP tool | When Dash saves, plus its resync |
| AI answer checks (ChatGPT, Google AI, ...) | LMS Dash | `sync_ai_answers` | Same |
| "From us" text in the report | Monthly note | `upsert_monthly_note` or the admin Updates tab | When written |

## Connecting a client site

The site side is the same as for LMS Dash: `lms-dash/docs/site-stats.md` (Cloudflare D1 counter
table, `/api/hit`, `/api/stats`, `STATS_TOKEN`). Maple Rental is the reference setup.

Then in the portal, either:

- Admin, client, **Settings**, **Website analytics**: the stats URL and the token, **Save and fetch now**; or
- MCP: `set_stats_source { clientId, statsUrl, statsToken }`.

The token is stored in `clients.stats_token` and never selected by `getClient` / `listClients`, so it
can't reach a page or an MCP answer. A failed fetch keeps the last good rows; admins see the error,
clients only see that the latest refresh didn't go through.

## How the report numbers are worked out

`src/lib/reports.ts`, pure functions, tested in `tests/results.test.ts`:

- **Leads** = calls + emails + quote requests (same as LMS Dash). Directions taps are shown but not counted.
- **Sources** use the same host lists as LMS Dash (`channel_of` in `app/growth.py`).
- **Percent change**: a finished month against the whole month before; the current month against the
  same number of days at the start of last month, so a half month never looks like a drop. No
  comparison is shown when the site wasn't counting yet in the earlier period.

## Rankings forecast

`src/lib/forecast.ts`. For each tracked search, three months ahead, with a likely position and a
range:

1. **Baseline**: each month a search closes part of the gap to a realistic target. Page two moves
   fastest (about a quarter of the gap a month), positions 4 to 10 close about a fifth, the top 3 move
   slowly, and a search we aren't found for takes a few months to enter the top 30.
2. **Observed trend**: with two or more months of real positions, a least-squares slope on log position
   is blended in, weighted 25% per extra month up to 70%, and clamped so one bad month can't predict a
   collapse.
3. The range widens with the horizon and with the square root of the position.

The page says plainly that it is an estimate and not a guarantee. Tune the constants in
`baselineStep` once a few months of real data show how fast Maple's searches actually move.
