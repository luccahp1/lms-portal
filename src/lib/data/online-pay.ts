/**
 * Paying invoices online from the client's Billing page (Stripe Checkout).
 *
 * LMS Dash owns payments: `sync_payments` replaces the portal's `payments` as a set, so a payment
 * written only here would be gone after the next sync. A Checkout page is therefore tracked in its
 * own table, `online_payments`, and is never a payment itself. Once the money is in:
 *
 *   1. the portal tells Dash (signed webhook, `payment.updated`);
 *   2. Dash pulls it with the MCP tool `list_online_payments` (and again on its 10-minute resync,
 *      so a lost webhook heals) and records a real payment with ref = the Stripe payment intent;
 *   3. Dash allocates it and sends it back with `sync_payments`, which sets `recordedAt` here.
 *
 * Until step 3 the client sees "Received, processing" and cannot pay the same invoice again.
 *
 * Three ways the portal hears about a Checkout page, all landing in `applyCheckout`, which does
 * nothing the second time: Stripe's webhook (/api/pay/stripe), the return page
 * (/portal/billing?session=...), and an admin reading `list_online_payments`.
 *
 * Ported from mikedash (src/lib/invoice-pay.ts). Same rules: the amount comes from the database,
 * never the request; one live payment page per client; a bank debit is "processing" until Stripe
 * says it cleared; the wrong amount, a withdrawn invoice or a second payment is held for a refund
 * and never passed to Dash.
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoices, onlinePayments, stripeEvents } from "@/db/schema";
import { TIME_ZONE } from "@/lib/format";
import { createCheckout, expireCheckout, getCheckout, stripeConfig, stripeConfigured, stripeTestMode, type CheckoutSession } from "@/lib/stripe";
import { notifyDashActivity } from "@/lib/webhook";
import { leftOn } from "./invoices";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

export type OnlinePayment = typeof onlinePayments.$inferSelect;
export type PayTarget = { invoice: string } | { balance: true };
export type StartError = "preview" | "notfound" | "paid" | "busy" | "nothing" | "off" | "failed";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_RE = /^cs_[A-Za-z0-9_]{8,200}$/;
/** Rows still waiting on Stripe that a reconcile asks about. A Checkout page lives 24 hours, a debit clears in days. */
const RECONCILE_DAYS = 30;

function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/+$/, "");
}

/** Whether Billing shows Pay buttons: Stripe keys are set and the portal knows its public address. */
export function onlinePayReady(): boolean {
  return stripeConfigured() && /^https?:\/\//.test(appUrl());
}

export { stripeTestMode };

/** A moment as a calendar day where LMS is. */
function dayOf(at: Date): string {
  return at.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function overlaps(a: string[], b: string[]): boolean {
  return a.some((n) => b.includes(n));
}

/** Money is in (or on its way) and Dash has not sent it back yet: the invoices it covers can't be paid again. */
function inFlight(p: Pick<OnlinePayment, "status" | "recordedAt">): boolean {
  return p.status === "processing" || p.status === "held" || (p.status === "paid" && !p.recordedAt);
}

function tell(p: Pick<OnlinePayment, "id" | "clientId">, status: string) {
  notifyDashActivity("payment.updated", p.clientId, { paymentId: p.id, status });
}

/* ── Starting a payment ──────────────────────────────────────────────── */

/**
 * A Stripe Checkout page for one invoice's unpaid part, or for everything the client owes.
 *
 * Only a client acting for themself: an admin in View as client gets "preview". The amount is
 * read here from the invoices LMS Dash sent. Any older page the client still has open is asked
 * about first (they may have paid on it a moment ago in another tab) and then closed: two live
 * pages is how someone pays twice.
 */
export async function startCheckout(
  viewer: Viewer,
  target: PayTarget,
): Promise<{ ok: true; url: string } | { ok: false; error: StartError }> {
  if (viewer.role !== "client" || viewer.previewBy) return { ok: false, error: "preview" };
  if (!onlinePayReady()) return { ok: false, error: "off" };
  const clientId = await resolveClientId(viewer);

  const shown = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.clientId, clientId), notInArray(invoices.status, ["draft"])));
  let kind: "invoice" | "balance";
  let picked: (typeof shown)[number][];
  if ("invoice" in target) {
    const inv = shown.find((i) => i.number === target.invoice);
    if (!inv) return { ok: false, error: "notfound" };
    if (leftOn(inv) <= 0) return { ok: false, error: "paid" };
    kind = "invoice";
    picked = [inv];
  } else {
    kind = "balance";
    picked = shown.filter((i) => leftOn(i) > 0).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    if (!picked.length) return { ok: false, error: "nothing" };
  }
  const numbers = picked.map((i) => i.number);
  const amountCents = picked.reduce((s, i) => s + leftOn(i), 0);

  const mine = await db.select().from(onlinePayments).where(eq(onlinePayments.clientId, clientId));
  if (mine.some((p) => inFlight(p) && (kind === "balance" || p.kind === "balance" || overlaps(p.invoiceNumbers, numbers)))) {
    return { ok: false, error: "busy" };
  }
  for (const p of mine.filter((r) => r.status === "open" && r.sessionId)) {
    const before = await getCheckout(p.sessionId!);
    if (before.ok) {
      const outcome = await applyCheckout(before.data, "return");
      if (outcome === "paid" || outcome === "processing") return { ok: false, error: "busy" };
      if (before.data.status === "open") await expireCheckout(p.sessionId!);
    }
    await db
      .update(onlinePayments)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(onlinePayments.id, p.id), eq(onlinePayments.status, "open")));
  }

  const cfg = stripeConfig()!;
  const [row] = await db
    .insert(onlinePayments)
    .values({ agencyId: viewer.agencyId, clientId, kind, invoiceNumbers: numbers, amountCents, currency: cfg.currency, createdBy: viewer.userId })
    .returning();
  const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId));
  const name = kind === "invoice" ? `Invoice ${numbers[0]}` : `Balance: ${numbers.join(", ")}`;
  const billing = appUrl() + "/portal/billing";
  const made = await createCheckout({
    paymentId: row!.id,
    name: name.length > 120 ? name.slice(0, 117) + "..." : name,
    amountCents,
    description: kind === "invoice" ? picked[0]!.description || client?.name || "" : `${client?.name ?? ""}, everything owed`,
    email: viewer.email,
    metadata: {
      client_id: clientId,
      kind,
      invoice_numbers: numbers.join(",").slice(0, 450),
      ...(kind === "invoice" ? { invoice_id: picked[0]!.id } : {}),
    },
    successUrl: billing + "?session={CHECKOUT_SESSION_ID}",
    cancelUrl: billing,
  });
  if (!made.ok || !made.data.url) {
    console.warn("Stripe checkout failed:", made.ok ? "no url" : made.error);
    await db.delete(onlinePayments).where(eq(onlinePayments.id, row!.id));
    return { ok: false, error: "failed" };
  }
  await db.update(onlinePayments).set({ sessionId: made.data.id, updatedAt: new Date() }).where(eq(onlinePayments.id, row!.id));
  return { ok: true, url: made.data.url };
}

/* ── Hearing back ────────────────────────────────────────────────────── */

export type CheckoutSource =
  | "return"
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "checkout.session.expired";
export type CheckoutOutcome = "paid" | "processing" | "failed" | "open" | "expired" | "held" | "ignored";

const STRIPE_EVENTS: readonly CheckoutSource[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
];

/** Money came in that must not reach Dash. Kept with the reason, for a refund in Stripe. */
async function hold(row: OnlinePayment, ref: string, problem: string): Promise<CheckoutOutcome> {
  const changed = await db
    .update(onlinePayments)
    .set({ status: "held", ref, problem, paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(onlinePayments.id, row.id), notInArray(onlinePayments.status, ["paid", "held"])))
    .returning({ id: onlinePayments.id });
  if (changed.length) {
    console.warn(`Online payment ${row.id} held: ${problem}`);
    tell(row, "held");
  }
  return "held";
}

/**
 * What a Checkout session means for its online payment, applied once.
 *
 * `source` says who told us: the webhook's event type decides a bank debit's fate, while the
 * return page and a reconcile can only read the session, which says "complete, unpaid" for a
 * debit still clearing (and still says so after it bounced).
 */
export async function applyCheckout(session: CheckoutSession, source: CheckoutSource): Promise<CheckoutOutcome> {
  const pid = session.metadata?.payment_id || session.client_reference_id || "";
  if (!UUID_RE.test(pid)) return "ignored";
  const [row] = await db.select().from(onlinePayments).where(eq(onlinePayments.id, pid));
  if (!row || row.sessionId !== session.id) return "ignored";
  const paymentRef = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? "");
  const now = new Date();

  if (source === "checkout.session.expired") {
    await db
      .update(onlinePayments)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(onlinePayments.id, row.id), eq(onlinePayments.status, "open")));
    return "expired";
  }

  if (source === "checkout.session.async_payment_failed") {
    const changed = await db
      .update(onlinePayments)
      .set({ status: "failed", updatedAt: now })
      .where(and(eq(onlinePayments.id, row.id), inArray(onlinePayments.status, ["open", "processing"])))
      .returning({ id: onlinePayments.id });
    if (changed.length) tell(row, "failed");
    return "failed";
  }

  if (session.status !== "complete") return session.status === "expired" ? "expired" : "open";
  if (row.status === "held") return "held";

  const cfg = stripeConfig();
  if (session.amount_total !== row.amountCents || (session.currency || "").toLowerCase() !== (cfg?.currency ?? row.currency)) {
    return hold(row, paymentRef, `Stripe took ${session.amount_total} ${session.currency}, the portal asked for ${row.amountCents} ${row.currency}. Refund ${paymentRef || session.id} in Stripe.`);
  }

  const settled = session.payment_status === "paid" || source === "checkout.session.async_payment_succeeded";

  if (!settled) {
    // Read back later, a debit that bounced still says "complete, unpaid": only the webhook knows it
    // failed. So a failed one stays failed here, or the client could never try again.
    if (source === "return" && row.status === "failed") return "failed";
    if (row.status === "paid") return "paid";
    const from = source === "return" ? ["open", "expired"] : ["open", "expired", "failed"];
    const changed = await db
      .update(onlinePayments)
      .set({ status: "processing", ref: paymentRef, method: "Bank debit", updatedAt: now })
      .where(and(eq(onlinePayments.id, row.id), inArray(onlinePayments.status, from)))
      .returning({ id: onlinePayments.id });
    if (changed.length) tell(row, "processing");
    return "processing";
  }

  if (row.status === "paid") {
    // A repeat. A second Stripe payment on the same page would be worth knowing about.
    if (row.ref && paymentRef && row.ref !== paymentRef) {
      await db
        .update(onlinePayments)
        .set({ problem: `Paid again (${paymentRef}). Refund one in Stripe.`, updatedAt: now })
        .where(eq(onlinePayments.id, row.id));
      console.warn(`Online payment ${row.id} paid twice: ${row.ref} and ${paymentRef}`);
    }
    return "paid";
  }

  // Is there still something to pay? Invoices change in Dash while a page is open.
  const current = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.clientId, row.clientId), inArray(invoices.number, row.invoiceNumbers.length ? row.invoiceNumbers : [""])));
  const live = current.filter((i) => i.status !== "draft");
  if (row.kind === "invoice") {
    const inv = live[0];
    if (!inv) return hold(row, paymentRef, `Invoice ${row.invoiceNumbers[0]} was withdrawn before this payment came in. Refund ${paymentRef} in Stripe.`);
    if (leftOn(inv) <= 0) return hold(row, paymentRef, `Invoice ${inv.number} was already paid. Refund ${paymentRef} in Stripe.`);
  } else if (!live.some((i) => leftOn(i) > 0)) {
    return hold(row, paymentRef, `Everything on this balance was already paid. Refund ${paymentRef} in Stripe.`);
  }
  const others = await db
    .select()
    .from(onlinePayments)
    .where(and(eq(onlinePayments.clientId, row.clientId), eq(onlinePayments.status, "paid"), isNull(onlinePayments.recordedAt)));
  const twice = others.find((p) => p.id !== row.id && (row.kind === "balance" || p.kind === "balance" || overlaps(p.invoiceNumbers, row.invoiceNumbers)));
  if (twice) return hold(row, paymentRef, `Paid twice: ${twice.ref} already covers this. Refund ${paymentRef} in Stripe.`);

  const method = row.status === "processing" || source === "checkout.session.async_payment_succeeded" ? "Bank debit" : "Card";
  const changed = await db
    .update(onlinePayments)
    .set({ status: "paid", method, ref: paymentRef, problem: "", paidAt: now, updatedAt: now })
    .where(and(eq(onlinePayments.id, row.id), notInArray(onlinePayments.status, ["paid", "held"])))
    .returning({ id: onlinePayments.id });
  if (changed.length) tell(row, "paid");
  return "paid";
}

/**
 * A Stripe event, once. Stripe retries until it gets a 2xx and can send one event twice, so the
 * event id is written first and a repeat stops there. If applying it throws, the id is removed
 * again so Stripe's retry is not taken for a repeat.
 */
export async function handleStripeEvent(event: { id?: string; type?: string; data?: { object?: unknown } }): Promise<CheckoutOutcome | "duplicate"> {
  const type = String(event.type || "") as CheckoutSource;
  if (!STRIPE_EVENTS.includes(type)) return "ignored";
  const session = event.data?.object as CheckoutSession | undefined;
  if (!session || typeof session.id !== "string" || !event.id) return "ignored";
  const pid = session.metadata?.payment_id || session.client_reference_id || "";

  const fresh = await db
    .insert(stripeEvents)
    .values({ id: String(event.id), type, paymentId: UUID_RE.test(pid) ? pid : null })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (!fresh.length) return "duplicate";
  try {
    return await applyCheckout(session, type);
  } catch (err) {
    await db.delete(stripeEvents).where(eq(stripeEvents.id, String(event.id)));
    throw err;
  }
}

/** The return page's check: only a session that belongs to one of this client's own payments. */
export async function confirmReturn(viewer: Viewer, sessionId: string): Promise<CheckoutOutcome | null> {
  if (!stripeConfigured() || !SESSION_RE.test(sessionId)) return null;
  const clientId = await resolveClientId(viewer);
  const [row] = await db
    .select({ id: onlinePayments.id })
    .from(onlinePayments)
    .where(and(eq(onlinePayments.clientId, clientId), eq(onlinePayments.sessionId, sessionId)));
  if (!row) return null;
  const s = await getCheckout(sessionId);
  if (!s.ok) return null;
  if ((s.data.metadata?.payment_id || s.data.client_reference_id) !== row.id) return null;
  return applyCheckout(s.data, "return");
}

/** Ask Stripe about payments still waiting on it, in case a webhook was never set up or got lost. */
async function reconcile(agencyId: string, clientId?: string): Promise<void> {
  if (!stripeConfigured()) return;
  const since = new Date(Date.now() - RECONCILE_DAYS * 86_400_000);
  const waiting = await db
    .select({ sessionId: onlinePayments.sessionId })
    .from(onlinePayments)
    .where(
      and(
        eq(onlinePayments.agencyId, agencyId),
        clientId ? eq(onlinePayments.clientId, clientId) : undefined,
        inArray(onlinePayments.status, ["open", "processing"]),
        isNotNull(onlinePayments.sessionId),
        gte(onlinePayments.createdAt, since),
      ),
    )
    .limit(50);
  for (const w of waiting) {
    const s = await getCheckout(w.sessionId!);
    if (s.ok) await applyCheckout(s.data, "return");
  }
}

/* ── Reading ─────────────────────────────────────────────────────────── */

function out(p: OnlinePayment & { clientName?: string }) {
  return {
    id: p.id,
    clientId: p.clientId,
    clientName: p.clientName,
    kind: p.kind,
    invoiceNumbers: p.invoiceNumbers,
    amountCents: p.amountCents,
    currency: p.currency,
    status: p.status,
    method: p.method,
    ref: p.ref,
    problem: p.problem,
    paidOn: p.paidAt ? dayOf(p.paidAt) : null,
    recorded: !!p.recordedAt,
    sessionId: p.sessionId,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Online payments for LMS Dash and admins, newest first, after asking Stripe about any still
 * waiting. `pending`: only the ones paid and not yet recorded in Dash (what Dash imports).
 * Open and expired pages are left out unless `all` is set.
 */
export async function listOnlinePayments(viewer: Viewer, opts: { clientId?: string; pending?: boolean; all?: boolean; limit?: number } = {}) {
  assertAdmin(viewer);
  const clientId = opts.clientId ? await resolveClientId(viewer, opts.clientId) : undefined;
  await reconcile(viewer.agencyId, clientId);
  const rows = await db
    .select({ p: onlinePayments, clientName: clients.name })
    .from(onlinePayments)
    .innerJoin(clients, eq(clients.id, onlinePayments.clientId))
    .where(
      and(
        eq(onlinePayments.agencyId, viewer.agencyId),
        clientId ? eq(onlinePayments.clientId, clientId) : undefined,
        opts.pending
          ? and(eq(onlinePayments.status, "paid"), isNull(onlinePayments.recordedAt))
          : opts.all
            ? undefined
            : notInArray(onlinePayments.status, ["open", "expired"]),
      ),
    )
    .orderBy(desc(onlinePayments.createdAt))
    .limit(Math.min(opts.limit ?? 200, 500));
  return { configured: stripeConfigured(), testMode: stripeTestMode(), payments: rows.map((r) => out({ ...r.p, clientName: r.clientName })) };
}

/**
 * What the client's Billing page needs: whether Pay shows, and the online payments still in
 * flight (processing, received but not recorded by Dash, held) or recently failed. A failed one
 * drops off once a newer payment covers the same invoices.
 */
export async function clientPayState(viewer: Viewer) {
  const clientId = await resolveClientId(viewer);
  const rows = await db
    .select()
    .from(onlinePayments)
    .where(and(eq(onlinePayments.clientId, clientId), gte(onlinePayments.createdAt, new Date(Date.now() - 45 * 86_400_000))))
    .orderBy(desc(onlinePayments.createdAt));
  const flying = rows.filter(inFlight);
  const failed = rows.filter(
    (f, i) =>
      f.status === "failed" &&
      !rows.slice(0, i).some((n) => n.status !== "open" && n.status !== "expired" && (n.kind === "balance" || f.kind === "balance" || overlaps(n.invoiceNumbers, f.invoiceNumbers))),
  );
  const covered = new Set(flying.flatMap((p) => p.invoiceNumbers));
  return {
    ready: onlinePayReady(),
    testMode: stripeTestMode(),
    /** Invoice numbers with a payment on the way: no Pay button on them. */
    covered: [...covered],
    /** Nothing can be paid as a whole balance while any payment is still on its way. */
    balanceBusy: flying.length > 0,
    pending: flying.map((p) => out(p)),
    failed: failed.map((p) => out(p)),
  };
}

/** The client opened Billing: their sent invoices count as seen. An admin previewing changes nothing. */
export async function markInvoicesViewed(viewer: Viewer) {
  if (viewer.role !== "client" || viewer.previewBy) return;
  const clientId = await resolveClientId(viewer);
  await db
    .update(invoices)
    .set({ viewedAt: new Date() })
    .where(and(eq(invoices.clientId, clientId), notInArray(invoices.status, ["draft"]), isNull(invoices.viewedAt)));
}

/** sync_payments brought these refs back from Dash: those online payments are recorded now. */
export async function markRecorded(clientId: string, refs: string[]) {
  const ids = refs.filter((r) => r.startsWith("pi_"));
  if (!ids.length) return;
  await db
    .update(onlinePayments)
    .set({ recordedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(onlinePayments.clientId, clientId), eq(onlinePayments.status, "paid"), isNull(onlinePayments.recordedAt), inArray(onlinePayments.ref, ids)));
}
