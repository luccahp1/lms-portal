import { refreshAllStats } from "@/lib/stats/refresh";

// Refreshes every client's site stats hourly, so the Reports page reads a fresh stored copy
// instead of calling the client's site on each view. Production only; STATS_REFRESH=off skips it.

const HOUR_MS = 60 * 60 * 1000;

if (process.env.NODE_ENV === "production" && process.env.STATS_REFRESH !== "off") {
  const run = () => refreshAllStats().catch((err) => console.error("hourly stats refresh failed", err));
  setTimeout(run, 30_000);
  setInterval(run, HOUR_MS);
}
