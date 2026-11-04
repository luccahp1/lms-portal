// Ranking forecast for the next few months. Pure functions, no db.
//
// Google positions don't move in straight lines, so this is an estimate with a range, and the
// page says so. Two parts:
//  1. A baseline for a site with monthly SEO work: each month a search closes part of the gap
//     to a realistic target. The share depends on where it sits (page 2 moves fastest, the
//     top 3 slowest, a search we aren't found for usually takes a couple of months to enter
//     the top 30).
//  2. Once there are two or more months of real positions, the observed trend (least squares
//     on log position, so 30 -> 20 counts like 3 -> 2) is blended in, trusted more with every
//     extra month.

export const NOT_FOUND = 0;
/** Where "not in the first three pages" sits when we do the maths. */
const UNRANKED = 35;
const MAX_SHOWN = 30;

export type RankPoint = { month: string; position: number };
export type ForecastPoint = { month: string; likely: number | null; best: number | null; worst: number | null };

function asNumber(position: number) {
  return position === NOT_FOUND || position > MAX_SHOWN ? UNRANKED : position;
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** One month of the baseline: how far a search at `pos` usually moves with steady work. */
export function baselineStep(pos: number): number {
  if (pos <= 1) return 1;
  if (pos <= 3) return Math.max(1, pos - 0.35);
  if (pos <= 10) return Math.max(1, pos - (pos - 1) * 0.18);
  if (pos <= MAX_SHOWN) return Math.max(3, pos - (pos - 6) * 0.24);
  // Not found yet: a slow start: new pages take a few months to enter the top 30.
  return pos - (pos - 22) * 0.12;
}

/** Slope of log(position) per month, from the real history (oldest first). */
export function observedSlope(history: RankPoint[]): number | null {
  if (history.length < 2) return null;
  const pts = history.map((h, i) => [i, Math.log(asNumber(h.position))] as const);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  return sxx ? sxy / sxx : null;
}

function clamp(v: number) {
  return Math.min(UNRANKED, Math.max(1, v));
}

function shown(v: number): number | null {
  const r = Math.round(clamp(v));
  return r > MAX_SHOWN ? null : r;
}

/**
 * Forecast `months` ahead from a keyword's history (any order). `null` positions in the
 * result mean "probably still not in the first three pages".
 */
export function forecastKeyword(history: RankPoint[], months = 3): ForecastPoint[] {
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const last = sorted.at(-1);
  if (!last) return [];
  const slope = observedSlope(sorted);
  // Trust the real trend more with more months, never fully: one bad month shouldn't decide it.
  const weight = slope === null ? 0 : Math.min(0.7, (sorted.length - 1) * 0.25);
  // Never forecast a collapse from a single dip, or a jump of more than half the log range a month.
  const trend = slope === null ? 0 : Math.max(-0.5, Math.min(0.25, slope));

  const out: ForecastPoint[] = [];
  let pos = asNumber(last.position);
  for (let h = 1; h <= months; h++) {
    const base = baselineStep(pos);
    const fromTrend = pos * Math.exp(trend);
    pos = clamp(weight * fromTrend + (1 - weight) * base);
    // The range widens with distance and with how far down the page the search is.
    const spread = 0.6 + 0.45 * h * Math.sqrt(pos);
    out.push({
      month: shiftMonth(last.month, h),
      likely: shown(pos),
      best: shown(pos - spread),
      worst: shown(pos + spread * 1.3),
    });
  }
  return out;
}

/** Plain words for a forecast's end point, for the page. */
export function describeForecast(current: number, likely: number | null): string {
  if (likely === null) return current === NOT_FOUND ? "Likely still outside the top 30" : "Could drop out of the top 30";
  if (current === NOT_FOUND || current > MAX_SHOWN) return likely <= 10 ? "Could reach page one" : "Likely to enter the top 30";
  if (likely < current) return likely <= 3 ? "On track for the top 3" : likely <= 10 ? "Moving toward page one" : "Climbing";
  if (likely === current) return current <= 3 ? "Holding near the top" : "Holding steady";
  return "Might slip";
}
