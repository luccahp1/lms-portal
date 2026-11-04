import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, siteStats, type StatRow } from "@/db/schema";

// Pulls anonymous visit counts from each client's own site (GET <statsUrl>?from=&to=,
// bearer token) into site_stats. Runs hourly from src/instrumentation.ts, and on demand
// when a page finds the copy older than STALE_MS. Pages always read the stored copy, so
// a slow or broken client site never slows the portal down.

export const STALE_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
// Keep 13 months: this month, last month and a year of history for the reports.
const MONTHS_KEPT = 13;

const inFlight = new Map<string, Promise<void>>();

function firstDayMonthsAgo(months: number, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  return d.toISOString().slice(0, 10);
}

function isStatRow(r: unknown): r is StatRow {
  const o = r as Record<string, unknown>;
  return !!o && typeof o.day === "string" && typeof o.kind === "string" && Number.isFinite(Number(o.n));
}

async function fetchRows(statsUrl: string, token: string) {
  const url = new URL(statsUrl);
  url.searchParams.set("from", firstDayMonthsAgo(MONTHS_KEPT - 1));
  url.searchParams.set("to", new Date().toISOString().slice(0, 10));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Site answered ${res.status}`);
  const body = (await res.json()) as { ok?: boolean; since?: string | null; rows?: unknown[] };
  if (!body.ok || !Array.isArray(body.rows)) throw new Error("Site sent an unexpected answer");
  const rows: StatRow[] = body.rows.filter(isStatRow).map((r) => ({
    day: r.day,
    kind: r.kind,
    page: r.page ?? "",
    source: r.source ?? "",
    detail: r.detail ?? "",
    n: Number(r.n),
  }));
  return { rows, since: body.since && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : null };
}

/** Refresh one client's stats. Concurrent callers share one request. Never throws. */
export function refreshClientStats(clientId: string): Promise<void> {
  const running = inFlight.get(clientId);
  if (running) return running;
  const job = (async () => {
    const [client] = await db
      .select({ id: clients.id, agencyId: clients.agencyId, statsUrl: clients.statsUrl, statsToken: clients.statsToken })
      .from(clients)
      .where(eq(clients.id, clientId));
    if (!client?.statsUrl || !client.statsToken) return;
    const [current] = await db.select().from(siteStats).where(eq(siteStats.clientId, clientId));
    try {
      const { rows, since } = await fetchRows(client.statsUrl, client.statsToken);
      const changed = !current || current.error || JSON.stringify(current.rows) !== JSON.stringify(rows);
      // Only rewrite the rows when they changed: the write is what tells open pages to refresh.
      const values = changed ? { rows, since, fetchedAt: new Date(), error: null } : { fetchedAt: new Date() };
      await db
        .insert(siteStats)
        .values({ clientId, agencyId: client.agencyId, rows, since, fetchedAt: new Date() })
        .onConflictDoUpdate({ target: siteStats.clientId, set: values });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await db
        .insert(siteStats)
        .values({ clientId, agencyId: client.agencyId, fetchedAt: new Date(), error })
        .onConflictDoUpdate({ target: siteStats.clientId, set: { fetchedAt: new Date(), error } });
    }
  })()
    .catch((err) => console.error("stats refresh failed", clientId, err))
    .finally(() => inFlight.delete(clientId));
  inFlight.set(clientId, job);
  return job;
}

/** Every client that has a stats source. Called hourly. */
export async function refreshAllStats() {
  const rows = await db.select({ id: clients.id }).from(clients).where(isNotNull(clients.statsUrl));
  for (const r of rows) await refreshClientStats(r.id);
}
