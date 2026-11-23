/**
 * POST /api/pay/stripe: Stripe's webhook.
 *
 * Set up in LMS's Stripe dashboard (Developers, Webhooks) as
 * https://portal.londonmarketingsolutions.ca/api/pay/stripe with these events:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded
 *   checkout.session.async_payment_failed
 *   checkout.session.expired
 * and its signing secret in STRIPE_WEBHOOK_SECRET. docs/online-payments.md.
 *
 * Nothing is trusted until the signature over the raw body checks out. A repeat delivery answers
 * 200 and changes nothing. A failure while applying answers 500, so Stripe tries again later.
 */

import { handleStripeEvent } from "@/lib/data/online-pay";
import { stripeConfig, verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cfg = stripeConfig();
  if (!cfg || !cfg.webhookSecret) return new Response("Not set up", { status: 404 });

  const raw = await req.text();
  if (raw.length > 512_000) return new Response("Too large", { status: 413 });
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), cfg.webhookSecret)) {
    return new Response("Bad signature", { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    if (outcome === "duplicate") return new Response("duplicate", { status: 200 });
    return Response.json({ received: true, outcome });
  } catch (err) {
    console.warn("Stripe webhook " + String(event.type) + " failed:", err instanceof Error ? err.message : err);
    return new Response("Try again", { status: 500 });
  }
}
