import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, siteStats } from "@/db/schema";
import { refreshClientStats, STALE_MS } from "@/lib/stats/refresh";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

/** Where the client's site serves its counts. The token is write-only from here on. */
export async function setStatsSource(viewer: Viewer, clientId: string, input: { statsUrl: string; statsToken?: string }) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const url = input.statsUrl.trim();
  if (url && !/^https:\/\//.test(url)) throw new Error("Stats URL must start with https://");
  const set: Partial<typeof clients.$inferInsert> = { statsUrl: url || null };
  if (input.statsToken !== undefined && input.statsToken !== "") set.statsToken = input.statsToken.trim();
  if (!url) set.statsToken = null;
  await db.update(clients).set(set).where(eq(clients.id, id));
  if (url) await refreshClientStats(id);
}

export async function getStatsSource(viewer: Viewer, clientId: string) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db
    .select({ statsUrl: clients.statsUrl, hasToken: clients.statsToken })
    .from(clients)
    .where(eq(clients.id, id));
  return { statsUrl: row?.statsUrl ?? "", hasToken: Boolean(row?.hasToken) };
}

/**
 * The stored copy of the client's site stats. Older than an hour: kick off a refresh in
 * the background and return what we have (the refresh notifies open pages when it lands).
 * Never fetched yet: wait for the first fetch so the page isn't empty.
 */
export async function getSiteStats(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [joined] = await db
    .select({ statsUrl: clients.statsUrl, stats: siteStats })
    .from(clients)
    .leftJoin(siteStats, eq(siteStats.clientId, clients.id))
    .where(eq(clients.id, id));
  const connected = Boolean(joined?.statsUrl);
  let row = joined?.stats ?? undefined;
  if (connected && !row?.fetchedAt) {
    await refreshClientStats(id);
    [row] = await db.select().from(siteStats).where(eq(siteStats.clientId, id));
  } else if (connected && row?.fetchedAt && Date.now() - row.fetchedAt.getTime() > STALE_MS) {
    void refreshClientStats(id);
  }
  return {
    connected,
    rows: row?.rows ?? [],
    since: row?.since ?? null,
    fetchedAt: row?.fetchedAt ?? null,
    // Clients only learn that something is off, not the details.
    error: row?.error ? (viewer.role === "agency_admin" ? row.error : "unavailable") : null,
  };
}
