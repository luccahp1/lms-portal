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
  input: { number: string; description: string; amountCents: number; issuedOn: string; dueOn: string; status: InvoiceStatus },
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

/** What the client owes right now: every sent invoice, split into overdue and not yet due. */
export function balance(rows: { status: InvoiceStatus; amountCents: number; dueOn: string }[], today: string) {
  const sent = rows.filter((i) => i.status === "sent");
  const overdue = sent.filter((i) => i.dueOn < today);
  const sum = (list: typeof rows) => list.reduce((s, i) => s + i.amountCents, 0);
  return {
    owing: sum(sent),
    overdue: sum(overdue),
    overdueCount: overdue.length,
    paid: sum(rows.filter((i) => i.status === "paid")),
    nextDue: sent.filter((i) => i.dueOn >= today).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0]?.dueOn ?? null,
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
