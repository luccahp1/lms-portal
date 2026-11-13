// Billing rules from the standard Website Services Agreement, the same for every client:
// monthly invoices go out on the 1st and are due in 15 days (the 16th); invoices unpaid after
// 30 days may be charged 2% a month. The FAQ text is shared with LMS Dash (src/kit/billing-faq.json,
// synced from lms-dash app/static/kit).
import faq from "@/kit/billing-faq.json";
import { formatMoney } from "@/lib/format";

export const INVOICE_DAY = 1;
export const DUE_DAY = 16;
export const LATE_AFTER_DAYS = 30;
export const LATE_RATE = 0.02;

/** The next monthly invoice date (the next 1st after today) and the day it is due. */
export function nextMonthly(today: string) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m!, INVOICE_DAY)); // m is 1-based, so this is next month
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { invoiceOn: iso(first), dueOn: iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), DUE_DAY))) };
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Open invoices more than 30 days past due, with what 2% a month comes to. Nothing is charged. */
export function lateFees(open: { number: string; dueOn: string; leftCents: number }[], today: string) {
  const late = open.filter((i) => daysBetween(i.dueOn, today) > LATE_AFTER_DAYS);
  const cents = late.reduce((s, i) => s + i.leftCents, 0);
  return { late, cents, perMonthCents: Math.round(cents * LATE_RATE) };
}

export function faqItems(monthlyCents: number | null | undefined) {
  const monthly = monthlyCents ? `${formatMoney(monthlyCents)} a month` : "your monthly fee";
  return faq.items.map((i) => ({ q: i.q, a: i.a.replaceAll("{monthly}", monthly) }));
}
