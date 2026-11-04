import type { StatRow } from "@/db/schema";

// Turns raw site counter rows into the numbers on the Reports page. Pure functions, no db.
// The channel rules match LMS Dash (app/growth.py) so both show the same numbers.

const CHANNELS: { key: string; label: string; hosts: string[] }[] = [
  {
    key: "ai",
    label: "AI assistants",
    hosts: ["chatgpt.com", "chat.openai.com", "openai.com", "perplexity.ai", "gemini.google.com", "bard.google.com",
      "copilot.microsoft.com", "claude.ai", "you.com", "meta.ai", "chat.mistral.ai", "deepseek.com"],
  },
  { key: "email", label: "Email", hosts: ["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com"] },
  {
    key: "search",
    label: "Search engines",
    hosts: ["google.", "bing.com", "duckduckgo.com", "yahoo.", "ecosia.org", "search.brave.com", "yandex.", "baidu.com",
      "startpage.com", "qwant.com"],
  },
  {
    key: "social",
    label: "Social media",
    hosts: ["facebook.com", "instagram.com", "linkedin.com", "lnkd.in", "t.co", "x.com", "twitter.com", "reddit.com",
      "youtube.com", "tiktok.com", "pinterest."],
  },
];

export const CHANNEL_LABEL: Record<string, string> = {
  direct: "Typed in or bookmarked",
  other: "Other websites",
  ...Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])),
};

export function channelOf(host: string): string {
  const h = (host || "").toLowerCase();
  if (!h) return "direct";
  for (const c of CHANNELS) {
    for (const x of c.hosts) {
      if (h === x || h.endsWith("." + x) || (x.endsWith(".") && (h.startsWith(x) || h.includes("." + x)))) return c.key;
    }
  }
  return "other";
}

export type Period = { start: string; end: string };

export type Summary = {
  visits: number;
  views: number;
  calls: number;
  emails: number;
  directions: number;
  quotes: number;
  leads: number;
  series: { day: string; visits: number; leads: number }[];
  pages: { name: string; n: number }[];
  channels: { key: string; label: string; visits: number; leads: number }[];
  services: { name: string; n: number }[];
};

const LEAD_KINDS = new Set(["call", "email", "quote"]);

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function top(m: Map<string, number>, n = 8) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, v]) => ({ name, n: v }));
}

export function summarise(rows: StatRow[], { start, end }: Period): Summary {
  const totals: Record<string, number> = { visit: 0, view: 0, call: 0, email: 0, directions: 0, quote: 0 };
  const days = new Map<string, { visits: number; leads: number }>();
  const pages = new Map<string, number>();
  const channels = new Map<string, { visits: number; leads: number }>();
  const services = new Map<string, number>();
  for (const r of rows) {
    if (r.day < start || r.day > end || !(r.kind in totals)) continue;
    const n = Number(r.n) || 0;
    totals[r.kind] += n;
    const d = days.get(r.day) ?? { visits: 0, leads: 0 };
    days.set(r.day, d);
    const ch = channels.get(channelOf(r.source)) ?? { visits: 0, leads: 0 };
    channels.set(channelOf(r.source), ch);
    if (r.kind === "visit") {
      d.visits += n;
      ch.visits += n;
    } else if (r.kind === "view") {
      pages.set(r.page || "/", (pages.get(r.page || "/") ?? 0) + n);
    } else if (LEAD_KINDS.has(r.kind)) {
      d.leads += n;
      ch.leads += n;
    }
    if (r.kind === "quote") services.set(r.detail || "Not given", (services.get(r.detail || "Not given") ?? 0) + n);
  }
  const series = [];
  for (let day = start; day <= end; day = addDays(day, 1)) series.push({ day, ...(days.get(day) ?? { visits: 0, leads: 0 }) });
  return {
    visits: totals.visit,
    views: totals.view,
    calls: totals.call,
    emails: totals.email,
    directions: totals.directions,
    quotes: totals.quote,
    leads: totals.call + totals.email + totals.quote,
    series,
    pages: top(pages),
    channels: [...channels.entries()]
      .filter(([, v]) => v.visits || v.leads)
      .sort((a, b) => b[1].visits - a[1].visits)
      .map(([key, v]) => ({ key, label: CHANNEL_LABEL[key] ?? key, ...v })),
    services: top(services),
  };
}

/** Percent change, or null when there is nothing to compare against. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDay(month: string) {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

/**
 * The period for a report month and the one it is compared with. A finished month is
 * compared with the whole month before it. The current month is compared with the same
 * number of days at the start of last month, so a half month never looks like a drop.
 */
export function reportPeriods(month: string, today: string) {
  const start = `${month}-01`;
  const fullEnd = lastDay(month);
  const prevMonth = shiftMonth(month, -1);
  const prevStart = `${prevMonth}-01`;
  const prevFullEnd = lastDay(prevMonth);
  if (today >= fullEnd) {
    return { current: { start, end: fullEnd }, previous: { start: prevStart, end: prevFullEnd }, partial: false };
  }
  const daysIn = Number(today.slice(8, 10));
  const prevEnd = addDays(prevStart, daysIn - 1);
  return {
    current: { start, end: today },
    previous: { start: prevStart, end: prevEnd > prevFullEnd ? prevFullEnd : prevEnd },
    partial: true,
  };
}

/** Months a report can be shown for: from the first counted day to this month, newest first. */
export function reportMonths(since: string | null, today: string): string[] {
  const now = today.slice(0, 7);
  if (!since) return [now];
  const out: string[] = [];
  for (let m = now; m >= since.slice(0, 7) && out.length < 24; m = shiftMonth(m, -1)) out.push(m);
  return out;
}
