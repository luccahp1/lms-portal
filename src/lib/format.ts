import type { FileApproval, InvoiceStatus, RequestStatus } from "@/db/schema";

export type Tone = "good" | "warn" | "info" | "neutral";

export const requestStatusLabel: Record<RequestStatus, { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  review: { label: "Ready for review", tone: "warn" },
  done: { label: "Done", tone: "good" },
};

export const invoiceStatusLabel: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Due", tone: "warn" },
  paid: { label: "Paid", tone: "good" },
};

export const fileApprovalLabel: Record<FileApproval, { label: string; tone: Tone } | null> = {
  none: null,
  pending: { label: "Needs approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  changes_requested: { label: "Changes requested", tone: "info" },
};

export function formatDate(value: Date | string) {
  // Plain YYYY-MM-DD dates are calendar days; don't let the timezone shift them.
  const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: Date) {
  return value.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMonth(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Multi-line textarea input → list items. */
export function lines(text: string) {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
