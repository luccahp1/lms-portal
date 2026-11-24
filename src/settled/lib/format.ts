/* Money, dates and small text helpers. Money is integer cents everywhere. */

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, cents: boolean): Intl.NumberFormat {
  const key = currency + (cents ? "c" : "");
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    fmtCache.set(key, f);
  }
  return f;
}

/** $1,234.56 */
export function money(cents: number, currency = "CAD"): string {
  return nf(currency, true).format((cents || 0) / 100);
}

/** $1,235 for dashboards and charts. */
export function moneyShort(cents: number, currency = "CAD"): string {
  const v = (cents || 0) / 100;
  if (Math.abs(v) >= 100_000) return nf(currency, false).format(Math.round(v / 1000)) + "k";
  return nf(currency, false).format(Math.round(v));
}

/** "734.60" for inputs. */
export function centsToInput(cents: number): string {
  return ((cents || 0) / 100).toFixed(2);
}

/** Parses "1,234.5" or "$80" to cents; null when it is not a number. */
export function inputToCents(v: string): number | null {
  const t = String(v ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  if (!/^-?\d*(\.\d{0,2})?\d*$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysStr(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** "Nov 24" this year, "Nov 24, 2025" otherwise. */
export function day(d: string | null | undefined): string {
  if (!d) return "";
  const x = parseDay(d);
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return `${MONTHS[x.getMonth()]} ${x.getDate()}${sameYear ? "" : ", " + x.getFullYear()}`;
}

export function dayLong(d: string | null | undefined): string {
  if (!d) return "";
  const x = parseDay(d);
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return MONTHS[(m || 1) - 1] + (y !== new Date().getFullYear() ? " " + String(y).slice(2) : "");
}

/** "just now", "5 min ago", "3 h ago", "Yesterday", "Nov 3". */
export function ago(ms: number | null | undefined): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return Math.round(diff / 60_000) + " min ago";
  if (diff < 86_400_000) return Math.round(diff / 3_600_000) + " h ago";
  const d = new Date(ms);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function dateTime(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`;
}

/** "Due in 5 days", "Due today", "4 days overdue". */
export function dueText(dueOn: string | null, daysOverdue = 0): string {
  if (!dueOn) return "Due on receipt";
  if (daysOverdue > 0) return daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`;
  const n = daysBetween(todayStr(), dueOn);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n > 1) return `Due in ${n} days`;
  return "Due " + day(dueOn);
}

export function initials(name: string): string {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A steady colour per name, from a small set that reads well in both themes. */
const AV = ["#0f7560", "#2563d9", "#a5591a", "#7c3aed", "#0b7f86", "#be3d61", "#5d6b12", "#9a4f00"];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  incoming: "Incoming",
  partial: "Part paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export const EVERY_LABEL: Record<string, string> = {
  week: "Every week",
  "2weeks": "Every 2 weeks",
  month: "Every month",
  quarter: "Every 3 months",
  year: "Every year",
};

/** "$3.0k" for tight labels; under $1,000 as whole dollars. */
export function moneyCompact(cents: number): string {
  const v = (cents || 0) / 100;
  if (Math.abs(v) >= 1000) return "$" + (v / 1000).toFixed(v >= 10_000 ? 0 : 1) + "k";
  return "$" + Math.round(v);
}
