import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { invoices, onlinePayments } from "@/db/schema";
import { callTool } from "@/lib/mcp/protocol";
import { upsertInvoice } from "@/lib/data/invoices";
import { listPayments } from "@/lib/data/payments";
import {
  applyCheckout,
  clientPayState,
  confirmReturn,
  listOnlinePayments,
  markInvoicesViewed,
  startCheckout,
  type PayTarget,
} from "@/lib/data/online-pay";
import type { Viewer } from "@/lib/data/viewer";
import { encodeForm, signStripePayload, verifyStripeSignature, type CheckoutSession } from "@/lib/stripe";
import { payResponse } from "@/lib/pay";
import { POST as webhook } from "@/app/api/pay/stripe/route";
import { makeAgency, resetDb } from "./helpers";

/**
 * Paying invoices online, against a real database and a fake Stripe.
 *
 * The fake is a local HTTP server that answers the calls src/lib/stripe.ts makes, records what it
 * was sent, and keeps sessions in memory. The tests then play Stripe's part: complete a session,
 * sign a webhook, send the client back. Ported from mikedash tests/invoice-pay.test.ts.
 */

const WHSEC = "whsec_test_do_not_use_anywhere_real";
let server: http.Server;
const sessions = new Map<string, CheckoutSession>();
const created: Record<string, string>[] = [];
const expired: string[] = [];
let refuseMethods: string[] = [];
let seq = 0;
const run = Date.now().toString(36);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (code: number, json: unknown) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(json));
      };
      if (req.headers.authorization !== "Bearer sk_test_fake") return send(401, { error: { message: "bad key" } });
      const url = req.url || "";
      if (req.method === "POST" && url === "/v1/checkout/sessions") {
        const form = Object.fromEntries(new URLSearchParams(body));
        created.push(form);
        const methods = Object.entries(form).filter(([k]) => k.startsWith("payment_method_types[")).map(([, v]) => v);
        const bad = methods.find((m) => refuseMethods.includes(m));
        if (bad) return send(400, { error: { message: "The payment method type provided: " + bad + " is invalid.", param: "payment_method_types" } });
        const id = "cs_test_" + run + String(++seq).padStart(10, "0");
        const metadata = Object.fromEntries(
          Object.entries(form)
            .filter(([k]) => k.startsWith("metadata["))
            .map(([k, v]) => [k.slice(9, -1), v]),
        );
        const s: CheckoutSession = {
          id,
          url: "https://checkout.stripe.test/" + id,
          status: "open",
          payment_status: "unpaid",
          amount_total: Number(form["line_items[0][price_data][unit_amount]"]),
          currency: form["line_items[0][price_data][currency]"] ?? null,
          client_reference_id: form.client_reference_id ?? null,
          metadata,
          payment_intent: null,
        };
        sessions.set(id, s);
        return send(200, s);
      }
      const m = /^\/v1\/checkout\/sessions\/(cs_[A-Za-z0-9_]+)(\/expire)?$/.exec(url);
      if (m) {
        const s = sessions.get(m[1]!);
        if (!s) return send(404, { error: { message: "No such session" } });
        if (m[2]) {
          expired.push(s.id);
          if (s.status === "open") s.status = "expired";
        }
        return send(200, s);
      }
      send(404, { error: { message: "unknown " + url } });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.STRIPE_API_BASE = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC;
  process.env.APP_URL = "https://portal.example.test";
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
});

beforeEach(async () => {
  await resetDb();
  await db.execute(sql`truncate stripe_events`);
  refuseMethods = [];
  created.length = 0;
  expired.length = 0;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
});

/** An agency whose client A has two sent invoices from Dash: LMS-1 $1,130.00 and LMS-2 $500.00 with $200 paid. */
async function setup() {
  const made = await makeAgency();
  const cid = made.clientA.client.id;
  await upsertInvoice(made.admin, cid, { number: "LMS-1", description: "Website build", amountCents: 113_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "sent" });
  await upsertInvoice(made.admin, cid, { number: "LMS-2", description: "Monthly", amountCents: 50_000, paidCents: 20_000, issuedOn: "2026-11-01", dueOn: "2026-11-20", status: "sent" });
  return { ...made, cid, client: made.clientA.viewer };
}

/** Play Stripe: finish the session the way a card (paid) or a bank debit (unpaid) finishes it. */
function complete(id: string, how: "card" | "debit"): CheckoutSession {
  const s = sessions.get(id) as CheckoutSession;
  s.status = "complete";
  s.payment_status = how === "card" ? "paid" : "unpaid";
  s.payment_intent = "pi_" + id.slice(-12);
  return s;
}

let eventSeq = 0;
function stripeEvent(type: string, session: CheckoutSession, id = "evt_" + run + "_" + ++eventSeq) {
  return { id, type, data: { object: session } };
}

function deliver(event: unknown, sign: (raw: string) => string = (raw) => signStripePayload(raw, WHSEC)) {
  const raw = JSON.stringify(event);
  return webhook(
    new Request("https://portal.example.test/api/pay/stripe", {
      method: "POST",
      headers: { "stripe-signature": sign(raw), "content-type": "application/json" },
      body: raw,
    }),
  );
}

async function pay(viewer: Viewer, target: PayTarget = { invoice: "LMS-1" }): Promise<string> {
  const started = await startCheckout(viewer, target);
  if (!started.ok) throw new Error(started.error);
  return started.url.split("/").pop() as string;
}

async function row(sessionId: string) {
  const [r] = await db.select().from(onlinePayments).where(eq(onlinePayments.sessionId, sessionId));
  return r!;
}

async function mcp(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, data: result.isError ? text : JSON.parse(text) };
}

describe("Stripe signatures", () => {
  const body = '{"id":"evt_1"}';

  it("accepts what Stripe signs and nothing else", () => {
    const at = 1_800_000_000_000;
    const header = signStripePayload(body, WHSEC, at);
    expect(verifyStripeSignature(body, header, WHSEC, at)).toBe(true);
    expect(verifyStripeSignature(body + " ", header, WHSEC, at)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_other", at)).toBe(false);
    expect(verifyStripeSignature(body, null, WHSEC, at)).toBe(false);
    expect(verifyStripeSignature(body, "t=1,v1=zz", WHSEC, at)).toBe(false);
  });

  it("refuses a delivery older than five minutes", () => {
    const at = 1_800_000_000_000;
    const header = signStripePayload(body, WHSEC, at);
    expect(verifyStripeSignature(body, header, WHSEC, at + 299_000)).toBe(true);
    expect(verifyStripeSignature(body, header, WHSEC, at + 301_000)).toBe(false);
  });

  it("takes any of several v1 signatures, as while a secret is rolled", () => {
    const at = 1_800_000_000_000;
    const good = signStripePayload(body, WHSEC, at);
    const header = good.split(",")[0] + ",v1=" + "0".repeat(64) + "," + good.split(",")[1];
    expect(verifyStripeSignature(body, header, WHSEC, at)).toBe(true);
  });

  it("encodes nested params the way Stripe reads them", () => {
    expect(encodeForm({ a: [{ b: { c: 1 } }], d: undefined, e: "x y" })).toBe("a%5B0%5D%5Bb%5D%5Bc%5D=1&e=x%20y");
  });
});

describe("Starting a payment", () => {
  it("asks Stripe for exactly the invoice's unpaid part, in cad, with card and a business bank debit", async () => {
    const { client, cid } = await setup();
    await pay(client, { invoice: "LMS-2" });
    const form = created[0]!;
    expect(form["line_items[0][price_data][unit_amount]"]).toBe("30000");
    expect(form["line_items[0][price_data][currency]"]).toBe("cad");
    expect(form["line_items[0][price_data][product_data][name]"]).toBe("Invoice LMS-2");
    expect(form["payment_method_types[0]"]).toBe("card");
    expect(form["payment_method_types[1]"]).toBe("acss_debit");
    expect(form["payment_method_options[acss_debit][mandate_options][transaction_type]"]).toBe("business");
    expect(form["metadata[client_id]"]).toBe(cid);
    expect(form["metadata[invoice_numbers]"]).toBe("LMS-2");
    expect(form["payment_intent_data[metadata][payment_id]"]).toBe(form.client_reference_id);
    expect(form.customer_email).toBe(client.email);
    expect(form.success_url).toBe("https://portal.example.test/portal/billing?session={CHECKOUT_SESSION_ID}");
    expect(form.cancel_url).toBe("https://portal.example.test/portal/billing");
  });

  it("pays the full balance as one page listing every open invoice", async () => {
    const { client } = await setup();
    const sid = await pay(client, { balance: true });
    expect(created[0]!["line_items[0][price_data][unit_amount]"]).toBe("143000");
    expect(created[0]!["metadata[invoice_numbers]"]).toBe("LMS-1,LMS-2");
    expect((await row(sid)).kind).toBe("balance");
  });

  it("falls back to cards alone when bank debit is not turned on", async () => {
    const { client } = await setup();
    refuseMethods = ["acss_debit"];
    await pay(client);
    expect(created).toHaveLength(2);
    expect(created[1]!["payment_method_types[1]"]).toBeUndefined();
  });

  it("closes the older payment page when a new one is opened", async () => {
    const { client } = await setup();
    const first = await pay(client);
    await pay(client, { invoice: "LMS-2" });
    expect(expired).toEqual([first]);
    expect((await row(first)).status).toBe("expired");
  });

  it("will not start for a draft, a paid invoice, an admin previewing, or with no keys", async () => {
    const { admin, client, cid } = await setup();
    await upsertInvoice(admin, cid, { number: "LMS-3", description: "", amountCents: 100, issuedOn: "2026-11-01", dueOn: "2026-11-01", status: "draft" });
    await upsertInvoice(admin, cid, { number: "LMS-4", description: "", amountCents: 100, issuedOn: "2026-11-01", dueOn: "2026-11-01", status: "paid" });
    expect(await startCheckout(client, { invoice: "LMS-3" })).toEqual({ ok: false, error: "notfound" });
    expect(await startCheckout(client, { invoice: "LMS-4" })).toEqual({ ok: false, error: "paid" });
    expect(await startCheckout({ ...client, previewBy: admin.userId }, { invoice: "LMS-1" })).toEqual({ ok: false, error: "preview" });
    expect(await startCheckout(admin, { invoice: "LMS-1" })).toEqual({ ok: false, error: "preview" });
    process.env.STRIPE_SECRET_KEY = "";
    expect(await startCheckout(client, { invoice: "LMS-1" })).toEqual({ ok: false, error: "off" });
    expect((await clientPayState(client)).ready).toBe(false);
    expect(created).toHaveLength(0);
  });
});

describe("Hearing back from Stripe", () => {
  it("marks it paid by card from a signed webhook, once", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const event = stripeEvent("checkout.session.completed", complete(sid, "card"));

    const res = await deliver(event);
    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("paid");
    const paid = await row(sid);
    expect(paid.status).toBe("paid");
    expect(paid.method).toBe("Card");
    expect(paid.ref).toBe("pi_" + sid.slice(-12));
    expect(paid.paidAt).not.toBeNull();

    const repeat = await deliver(event);
    expect(repeat.status).toBe(200);
    expect(await repeat.text()).toBe("duplicate");
    expect((await row(sid)).updatedAt.getTime()).toBe(paid.updatedAt.getTime());
  });

  it("refuses a webhook that is not signed with the secret", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const res = await deliver(stripeEvent("checkout.session.completed", complete(sid, "card")), (raw) => signStripePayload(raw, "whsec_forged"));
    expect(res.status).toBe(400);
    expect((await row(sid)).status).toBe("open");
  });

  it("answers 404 when Stripe is not set up here", async () => {
    process.env.STRIPE_SECRET_KEY = "";
    const res = await deliver({ id: "evt_x", type: "checkout.session.completed", data: { object: {} } });
    expect(res.status).toBe(404);
  });

  it("holds a payment whose amount differs, and never passes it to Dash", async () => {
    const { admin, client } = await setup();
    const sid = await pay(client);
    const s = complete(sid, "card");
    s.amount_total = 100;
    await deliver(stripeEvent("checkout.session.completed", s));
    const held = await row(sid);
    expect(held.status).toBe("held");
    expect(held.problem).toMatch(/Refund/);
    expect((await listOnlinePayments(admin, { pending: true })).payments).toHaveLength(0);
  });

  it("holds a bank debit as processing until Stripe says it succeeded", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const s = complete(sid, "debit");
    await deliver(stripeEvent("checkout.session.completed", s));
    expect((await row(sid)).status).toBe("processing");
    expect(await startCheckout(client, { invoice: "LMS-1" })).toEqual({ ok: false, error: "busy" });
    expect(await startCheckout(client, { balance: true })).toEqual({ ok: false, error: "busy" });
    const state = await clientPayState(client);
    expect(state.covered).toEqual(["LMS-1"]);
    expect(state.pending[0]!.status).toBe("processing");

    s.payment_status = "paid";
    await deliver(stripeEvent("checkout.session.async_payment_succeeded", s));
    const now = await row(sid);
    expect(now.status).toBe("paid");
    expect(now.method).toBe("Bank debit");
  });

  it("says so when a bank debit bounces, keeps it failed on a later read, and lets them pay again", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const s = complete(sid, "debit");
    await deliver(stripeEvent("checkout.session.completed", s));
    await deliver(stripeEvent("checkout.session.async_payment_failed", s));
    expect((await row(sid)).status).toBe("failed");
    // The session still reads "complete, unpaid" afterwards. It must not flip back to processing.
    expect(await confirmReturn(client, sid)).toBe("failed");
    expect((await row(sid)).status).toBe("failed");
    expect((await clientPayState(client)).failed).toHaveLength(1);
    const again = await pay(client);
    expect((await clientPayState(client)).failed).toHaveLength(1);
    await deliver(stripeEvent("checkout.session.completed", complete(again, "card")));
    expect((await clientPayState(client)).failed).toHaveLength(0);
  });

  it("marks it paid from the return page with no webhook at all", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    complete(sid, "card");
    expect(await confirmReturn(client, sid)).toBe("paid");
    expect((await row(sid)).status).toBe("paid");
  });

  it("picks up a payment when an admin lists online payments, if nothing else did", async () => {
    const { admin, client, cid } = await setup();
    const sid = await pay(client);
    complete(sid, "card");
    const listed = await mcp(admin, "list_online_payments", { clientId: cid });
    expect(listed.isError).toBe(false);
    expect(listed.data.payments).toHaveLength(1);
    expect(listed.data.payments[0]).toMatchObject({ status: "paid", method: "Card", amountCents: 113_000, invoiceNumbers: ["LMS-1"], recorded: false });
    expect(listed.data.testMode).toBe(true);
  });

  it("will not let another client's session pay from this client's return page", async () => {
    const { admin, client, clientB } = await setup();
    await upsertInvoice(admin, clientB.client.id, { number: "B-1", description: "", amountCents: 5_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "sent" });
    const sid = await pay(clientB.viewer, { invoice: "B-1" });
    complete(sid, "card");
    expect(await confirmReturn(client, sid)).toBeNull();
    expect((await row(sid)).status).toBe("open");
  });

  it("never passes on a payment for an invoice withdrawn in Dash, and holds it for a refund", async () => {
    const { admin, client, cid } = await setup();
    const sid = await pay(client);
    // Dash voids an invoice by sending it back as a draft.
    await upsertInvoice(admin, cid, { number: "LMS-1", description: "Website build", amountCents: 113_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "draft" });
    await deliver(stripeEvent("checkout.session.completed", complete(sid, "card")));
    const held = await row(sid);
    expect(held.status).toBe("held");
    expect(held.problem).toMatch(/withdrawn.*Refund pi_/);
  });

  it("holds a second payment for an invoice that was paid meanwhile", async () => {
    const { admin, client, cid } = await setup();
    const sid = await pay(client);
    await upsertInvoice(admin, cid, { number: "LMS-1", description: "Website build", amountCents: 113_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "paid" });
    await deliver(stripeEvent("checkout.session.completed", complete(sid, "card")));
    expect((await row(sid)).problem).toMatch(/already paid/);
  });

  it("forgets an expired page so a fresh one is made", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const s = sessions.get(sid)!;
    s.status = "expired";
    await deliver(stripeEvent("checkout.session.expired", s));
    expect((await row(sid)).status).toBe("expired");
    expect((await startCheckout(client, { invoice: "LMS-1" })).ok).toBe(true);
  });

  it("ignores a session the portal did not make", async () => {
    const { client } = await setup();
    const sid = await pay(client);
    const s = complete(sid, "card");
    // Another session pointed at a real payment row, and a session naming no row at all.
    expect(await applyCheckout({ ...s, id: "cs_test_someoneelse0000" }, "checkout.session.completed")).toBe("ignored");
    expect(await applyCheckout({ ...s, metadata: { payment_id: "00000000-0000-4000-8000-000000000000" }, client_reference_id: null }, "checkout.session.completed")).toBe("ignored");
    expect((await row(sid)).status).toBe("open");
  });
});

describe("The Pay button", () => {
  it("sends the browser to Stripe with a 303", async () => {
    const { client } = await setup();
    const form = new FormData();
    form.set("invoice", "LMS-1");
    const res = await payResponse(client, form);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^https:\/\/checkout\.stripe\.test\/cs_test_/);
  });

  it("an invoice that is not theirs is not found; errors go back to Billing", async () => {
    const { admin, client } = await setup();
    const form = new FormData();
    form.set("invoice", "B-9");
    expect((await payResponse(client, form)).status).toBe(404);
    const again = new FormData();
    again.set("invoice", "LMS-1");
    const res = await payResponse({ ...client, previewBy: admin.userId }, again);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/portal/billing?error=preview");
  });
});

describe("LMS Dash owns the payment", () => {
  it("survives a sync_payments from Dash, and is recorded once Dash sends it back", async () => {
    const { admin, client, cid } = await setup();
    const sid = await pay(client);
    await deliver(stripeEvent("checkout.session.completed", complete(sid, "card")));
    const ref = (await row(sid)).ref;

    // Dash's next sync, sent before it has imported the payment: its set does not have it.
    await mcp(admin, "sync_payments", { clientId: cid, monthlyCents: null, payments: [{ ref: "7", amountCents: 20_000, paidOn: "2026-11-10" }] });
    expect((await row(sid)).status).toBe("paid");
    let state = await clientPayState(client);
    expect(state.pending.map((p) => p.ref)).toEqual([ref]);
    expect(state.covered).toEqual(["LMS-1"]);
    const pending = await mcp(admin, "list_online_payments", { pending: true });
    expect(pending.data.payments.map((p: { ref: string }) => p.ref)).toEqual([ref]);

    // Dash imports it (ref = payment intent), allocates it and syncs back.
    await upsertInvoice(admin, cid, { number: "LMS-1", description: "Website build", amountCents: 113_000, paidCents: 113_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "paid" });
    await mcp(admin, "sync_payments", {
      clientId: cid,
      monthlyCents: null,
      payments: [
        { ref: "7", amountCents: 20_000, paidOn: "2026-11-10" },
        { ref, amountCents: 113_000, paidOn: "2026-11-23", note: "Card, paid online" },
      ],
    });
    expect((await row(sid)).recordedAt).not.toBeNull();
    state = await clientPayState(client);
    expect(state.pending).toHaveLength(0);
    expect(state.covered).toEqual([]);
    expect((await listPayments(client)).map((p) => p.ref)).toContain(ref);
    expect((await mcp(admin, "list_online_payments", { pending: true })).data.payments).toHaveLength(0);

    // A replay of the event after all that changes nothing.
    await applyCheckout(sessions.get(sid)!, "return");
    expect((await row(sid)).recordedAt).not.toBeNull();
  });

  it("notes when a client first opens Billing, and not for an admin preview", async () => {
    const { admin, client, cid } = await setup();
    await markInvoicesViewed({ ...client, previewBy: admin.userId });
    const before = await db.select().from(invoices).where(eq(invoices.clientId, cid));
    expect(before.every((i) => i.viewedAt === null)).toBe(true);
    await markInvoicesViewed(client);
    const after = await db.select().from(invoices).where(eq(invoices.clientId, cid));
    expect(after.every((i) => i.viewedAt !== null)).toBe(true);
    // Dash's next upsert does not clear it.
    await upsertInvoice(admin, cid, { number: "LMS-1", description: "Website build", amountCents: 113_000, issuedOn: "2026-11-01", dueOn: "2026-11-16", status: "sent" });
    const [one] = await db.select().from(invoices).where(eq(invoices.number, "LMS-1"));
    expect(one!.viewedAt).not.toBeNull();
  });
});
