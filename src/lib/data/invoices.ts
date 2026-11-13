import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoices, type InvoiceStatus } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";

/** Clients never see drafts. */
export async function listInvoices(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const where =
    viewer.role === "client"
      ? and(eq(invoices.clientId, id), ne(invoices.status, "draft"))
      : eq(invoices.clientId, id);
  return db.select().from(invoices).where(where).orderBy(desc(invoices.issuedOn), desc(invoices.createdAt));
}

export async function createInvoice(
  viewer: Viewer,
  clientId: string,
  input: { number: string; description: string; amountCents: number; issuedOn: string; dueOn: string; status: InvoiceStatus },
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  await db.insert(invoices).values({ agencyId: viewer.agencyId, clientId: id, ...input });
}

/** Create or update an invoice by its number (how LMS Dash keeps the portal in step). */
export async function upsertInvoice(
  viewer: Viewer,
  clientId: string,
  input: { number: string; description: string; amountCents: number; paidCents?: number; issuedOn: string; dueOn: string; status: InvoiceStatus },
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const [existing] = await db
    .select({ id: invoices.id, clientId: invoices.clientId })
    .from(invoices)
    .where(and(eq(invoices.agencyId, viewer.agencyId), eq(invoices.number, input.number)));
  if (existing && existing.clientId !== id) throw new Error(`Invoice ${input.number} belongs to another client`);
  if (existing) {
    await db.update(invoices).set(input).where(eq(invoices.id, existing.id));
    return { id: existing.id, created: false };
  }
  const [row] = await db
    .insert(invoices)
    .values({ agencyId: viewer.agencyId, clientId: id, ...input })
    .returning({ id: invoices.id });
  return { id: row!.id, created: true };
}

/**
 * Remove an invoice by its number. LMS Dash calls this when an invoice is deleted there, given a
 * new number, or moved to another client, so the old copy stops counting toward what a client
 * owes. Only the copy under `clientId` goes; false when that client has no such invoice.
 */
export async function deleteInvoiceByNumber(viewer: Viewer, clientId: string, number: string): Promise<boolean> {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const removed = await db
    .delete(invoices)
    .where(and(eq(invoices.agencyId, viewer.agencyId), eq(invoices.clientId, id), eq(invoices.number, number)))
    .returning({ id: invoices.id });
  return removed.length > 0;
}

type BalanceRow = { number?: string; description?: string; status: InvoiceStatus; amountCents: number; paidCents?: number; dueOn: string };

/** What is still owed on one invoice: nothing on drafts and paid ones, the unpaid part of a sent one. */
export function leftOn(i: BalanceRow) {
  return i.status === "sent" ? Math.max(0, i.amountCents - (i.paidCents ?? 0)) : 0;
}

/**
 * What the client owes right now. LMS Dash records the payments and works out how much of each
 * invoice they cover (paidCents), so a sent invoice can be part paid; only the rest counts.
 * owing: still to pay. paid: everything paid so far (paid invoices, part payments and any credit).
 * open: the invoices with something left on them, oldest due first, for the "Owed for" list.
 */
export function balance(rows: BalanceRow[], today: string, creditCents = 0) {
  const open = rows
    .filter((i) => leftOn(i) > 0)
    .map((i) => ({ number: i.number ?? "", description: i.description ?? "", dueOn: i.dueOn, leftCents: leftOn(i), partPaid: (i.paidCents ?? 0) > 0 }))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const overdue = open.filter((i) => i.dueOn < today);
  const sum = (list: { leftCents: number }[]) => list.reduce((s, i) => s + i.leftCents, 0);
  const paid =
    rows.reduce((s, i) => s + (i.status === "paid" ? i.amountCents : i.status === "sent" ? Math.min(i.amountCents, i.paidCents ?? 0) : 0), 0) +
    creditCents;
  return {
    owing: sum(open),
    overdue: sum(overdue),
    overdueCount: overdue.length,
    paid,
    credit: creditCents,
    open,
    nextDue: open.find((i) => i.dueOn >= today)?.dueOn ?? null,
  };
}

export async function setInvoiceStatus(viewer: Viewer, invoiceId: string, status: InvoiceStatus) {
  assertAdmin(viewer);
  const updated = await db
    .update(invoices)
    .set({ status })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, viewer.agencyId)))
    .returning({ id: invoices.id });
  if (updated.length === 0) throw new NotFoundError();
}
