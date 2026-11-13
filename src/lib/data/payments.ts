import { and, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, payments } from "@/db/schema";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

export type PaymentInput = { ref: string; amountCents: number; paidOn: string; note?: string };

/** Every payment the client has made, newest first. */
export async function listPayments(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({ id: payments.id, ref: payments.ref, amountCents: payments.amountCents, paidOn: payments.paidOn, note: payments.note, seenAt: payments.seenAt })
    .from(payments)
    .where(eq(payments.clientId, id))
    .orderBy(desc(payments.paidOn), desc(payments.createdAt));
}

/**
 * Replace a client's payments with this set (how LMS Dash keeps the portal in step). Payments not
 * listed are removed, with their notice. A payment already here keeps its seenAt, so a client who
 * dismissed "Payment received" does not see it again after the next sync. Also stores the monthly
 * amount shown on their Billing page (null: no monthly services) and any credit (paid beyond what
 * is owed).
 */
export async function syncPayments(
  viewer: Viewer,
  clientId: string,
  account: { monthlyCents: number | null; creditCents: number },
  list: PaymentInput[],
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const refs = list.map((p) => p.ref);
  await db.transaction(async (tx) => {
    await tx.update(clients).set(account).where(eq(clients.id, id));
    await tx
      .delete(payments)
      .where(and(eq(payments.clientId, id), refs.length ? notInArray(payments.ref, refs) : undefined));
    for (const p of list) {
      const values = { amountCents: p.amountCents, paidOn: p.paidOn, note: p.note ?? "" };
      await tx
        .insert(payments)
        .values({ agencyId: viewer.agencyId, clientId: id, ref: p.ref, ...values })
        .onConflictDoUpdate({ target: [payments.agencyId, payments.ref], set: { ...values, clientId: id } });
    }
  });
  return listPayments(viewer, id);
}

/** The client dismissed the "Payment received" notice: mark these (or all unseen) as seen. */
export async function markPaymentsSeen(viewer: Viewer, ids?: string[]) {
  const id = await resolveClientId(viewer);
  if (viewer.previewBy) return; // an admin previewing never clears the client's notice
  await db
    .update(payments)
    .set({ seenAt: new Date() })
    .where(and(eq(payments.clientId, id), isNull(payments.seenAt), ids?.length ? inArray(payments.id, ids) : undefined));
}
