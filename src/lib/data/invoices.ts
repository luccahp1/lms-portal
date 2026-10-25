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

export async function setInvoiceStatus(viewer: Viewer, invoiceId: string, status: InvoiceStatus) {
  assertAdmin(viewer);
  const updated = await db
    .update(invoices)
    .set({ status })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, viewer.agencyId)))
    .returning({ id: invoices.id });
  if (updated.length === 0) throw new NotFoundError();
}
