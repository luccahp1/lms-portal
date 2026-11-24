/**
 * The little of Stripe the portal uses: make a Checkout session, read one
 * back, close one, and check that a webhook really came from Stripe.
 *
 * Plain `fetch` rather than the `stripe` package: four calls, and the form
 * encoding is the whole of the work. Ported from mikedash (src/lib/stripe.ts).
 *
 * LMS's own Stripe account. The money goes to LMS's bank account.
 *
 *   STRIPE_SECRET_KEY       sk_live_... (or sk_test_... while trying it)
 *   STRIPE_WEBHOOK_SECRET   whsec_..., from the webhook endpoint for /api/pay/stripe
 *   STRIPE_PAYMENT_METHODS  optional, default "card,acss_debit"
 *   STRIPE_CURRENCY         optional, default "cad"
 *
 * `acss_debit` is a Canadian pre-authorized debit (PAD) straight from the
 * client's business bank account. It has to be turned on in the Stripe
 * dashboard; when it is not, the session is made again with cards alone
 * rather than the client seeing an error. Apple Pay and Google Pay come
 * with "card".
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  methods: string[];
  currency: string;
  apiBase: string;
}

export function stripeConfig(): StripeConfig | null {
  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!/^(sk|rk)_(live|test)_/.test(secretKey)) return null;
  const methods = (process.env.STRIPE_PAYMENT_METHODS || "card,acss_debit")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => /^[a-z_]+$/.test(m));
  return {
    secretKey,
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    methods: methods.length ? methods : ["card"],
    currency: (process.env.STRIPE_CURRENCY || "cad").trim().toLowerCase(),
    // Only the tests point this elsewhere, at a fake Stripe on localhost.
    apiBase: (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, ""),
  };
}

/** Whether online payment is set up here. */
export function stripeConfigured(): boolean {
  return stripeConfig() !== null;
}

/** Test keys take test cards only. Shown on the dashboard so nobody thinks a test payment was real. */
export function stripeTestMode(): boolean {
  return /^(sk|rk)_test_/.test((process.env.STRIPE_SECRET_KEY || "").trim());
}

/* ── Form encoding ───────────────────────────────────────────────────── */

type Param = string | number | boolean | null | undefined | Param[] | { [k: string]: Param };

/** Stripe's nested form keys: line_items[0][price_data][currency]=cad. */
export function encodeForm(params: Record<string, Param>): string {
  const out: string[] = [];
  const walk = (key: string, value: Param) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(key + "[" + i + "]", v));
    else if (typeof value === "object") for (const [k, v] of Object.entries(value)) walk(key + "[" + k + "]", v);
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.join("&");
}

/* ── Calls ───────────────────────────────────────────────────────────── */

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | string;
  /** "paid", "unpaid" (a bank debit still clearing) or "no_payment_required". */
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string } | null;
  payment_method_types?: string[];
}

type StripeResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; param?: string };

async function call<T>(
  cfg: StripeConfig,
  method: "GET" | "POST",
  pathname: string,
  body?: Record<string, Param>,
): Promise<StripeResult<T>> {
  try {
    const res = await fetch(cfg.apiBase + pathname, {
      method,
      headers: {
        authorization: "Bearer " + cfg.secretKey,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": "2024-06-20",
      },
      body: body ? encodeForm(body) : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: string; param?: string } })
      | null;
    if (!res.ok || !json) {
      return {
        ok: false,
        error: json?.error?.message || "Stripe answered " + res.status + ".",
        code: json?.error?.code,
        param: json?.error?.param,
      };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: "Could not reach Stripe: " + (err instanceof Error ? err.message : String(err)) };
  }
}

export interface CheckoutInput {
  /** The portal's online_payments row: client_reference_id and metadata.payment_id. */
  paymentId: string;
  /** Shown on Stripe's page and on the receipt: "Invoice LMS-0004" or "Balance, LMS-0004 and LMS-0005". */
  name: string;
  amountCents: number;
  description: string;
  email: string;
  /** Kept on the session and its payment intent, so either can be traced back here. */
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

/**
 * A hosted Checkout page for one amount, read from the database by the caller.
 *
 * The amount is one line rather than the invoice's own lines: the tax is
 * already in the total, and Stripe adding it up again is a second sum that
 * could disagree with the invoice by a cent.
 */
export async function createCheckout(input: CheckoutInput): Promise<StripeResult<CheckoutSession>> {
  const cfg = stripeConfig();
  if (!cfg) return { ok: false, error: "Online payment is not set up." };
  const metadata = { ...input.metadata, payment_id: input.paymentId };

  const build = (methods: string[]): Record<string, Param> => ({
    mode: "payment",
    client_reference_id: input.paymentId,
    customer_email: input.email || undefined,
    payment_method_types: methods,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: cfg.currency,
          unit_amount: input.amountCents,
          product_data: { name: input.name, description: input.description || undefined },
        },
      },
    ],
    // Our clients are businesses, so the debit agreement is a business one. No `currency` here:
    // Stripe only takes it in setup mode and refuses the whole session in payment mode.
    payment_method_options: methods.includes("acss_debit")
      ? {
          acss_debit: {
            verification_method: "automatic",
            mandate_options: { payment_schedule: "sporadic", transaction_type: "business" },
          },
        }
      : undefined,
    metadata,
    payment_intent_data: { description: input.name, metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  const first = await call<CheckoutSession>(cfg, "POST", "/v1/checkout/sessions", build(cfg.methods));
  if (first.ok || cfg.methods.length === 1 || !cfg.methods.includes("card")) return first;

  // A method the account has not turned on, or Stripe refusing one of its options. Cards always
  // work, so try again with them.
  if (first.param?.startsWith("payment_method") || /payment[ _]method/i.test(first.error)) {
    return call<CheckoutSession>(cfg, "POST", "/v1/checkout/sessions", build(["card"]));
  }
  return first;
}

export async function getCheckout(sessionId: string): Promise<StripeResult<CheckoutSession>> {
  const cfg = stripeConfig();
  if (!cfg) return { ok: false, error: "Online payment is not set up." };
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return { ok: false, error: "Not a Checkout session." };
  return call<CheckoutSession>(cfg, "GET", "/v1/checkout/sessions/" + sessionId);
}

/** Close an older session, so one invoice never has two live payment pages. Errors are fine to ignore. */
export async function expireCheckout(sessionId: string): Promise<void> {
  const cfg = stripeConfig();
  if (!cfg || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return;
  await call(cfg, "POST", "/v1/checkout/sessions/" + sessionId + "/expire", {});
}

/* ── Webhooks ────────────────────────────────────────────────────────── */

/**
 * Whether `Stripe-Signature` matches the raw body.
 *
 * Stripe signs `<timestamp>.<body>` with HMAC-SHA256 under the endpoint's
 * secret and sends `t=<timestamp>,v1=<hex>` (more than one v1 while a secret
 * is being rolled). Older than five minutes is refused, so a captured
 * delivery cannot be replayed later.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  at: number = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s.trim());
    if (k === "t") t = v ?? "";
    else if (k === "v1" && v) sigs.push(v);
  }
  if (!/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(at / 1000 - Number(t)) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(t + "." + rawBody, "utf8").digest();
  return sigs.some((s) => {
    if (!/^[0-9a-f]{64}$/i.test(s)) return false;
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** A header the way Stripe builds one. For the tests and the local fake. */
export function signStripePayload(rawBody: string, secret: string, at: number = Date.now()): string {
  const t = Math.floor(at / 1000);
  return "t=" + t + ",v1=" + createHmac("sha256", secret).update(t + "." + rawBody, "utf8").digest("hex");
}
