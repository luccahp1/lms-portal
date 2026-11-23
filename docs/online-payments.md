# Online payments

Clients pay their invoices from the Billing page: **Pay** on each unpaid invoice (its unpaid
part), or **Pay full balance** when more than one is open. Payment goes through a Stripe
Checkout page on LMS's own Stripe account. Cards, Apple Pay and Google Pay are covered by
"card". Canadian pre-authorized debit (PAD) from a business bank account is covered by
`acss_debit`. A paid invoice then shows as paid in both the portal and LMS Dash with no
manual step.

Code: `src/lib/stripe.ts` (Stripe calls, webhook signatures), `src/lib/data/online-pay.ts` (all
the rules), `src/app/portal/billing/pay/route.ts` (the Pay buttons),
`src/app/api/pay/stripe/route.ts` (the webhook). Ported from mikedash (commit 2da39fb).

## Who owns the payment

LMS Dash owns payments. `sync_payments` replaces the portal's `payments` as a set, so a payment
saved only here would be wiped by the next sync. The portal therefore keeps each Checkout page in
its own table, `online_payments`, and never writes to `payments`:

1. The client pays. Stripe's webhook (or the return page) marks the online payment `paid`.
2. The portal POSTs `payment.updated` to Dash's webhook (`LMS_DASH_WEBHOOK_URL`, signed as usual).
3. Dash calls `list_online_payments {pending: true}` and records each one as a real payment with
   `ref` = the Stripe payment intent (`pi_...`). A payment for one invoice is pointed at that
   invoice. A full-balance payment is left on auto, so Dash's usual rules spread it and any excess
   becomes credit. Dash remembers every ref it took (`stripe_imports`), so it never records one
   twice and never brings back one that was removed there.
4. Dash allocates it and sends it back with `sync_payments`. The `pi_...` ref coming back sets
   `recordedAt` on the online payment. From then on it is an ordinary payment.

Until step 4 the client sees **Received, processing** and cannot pay the same invoices again.
Dash pulls rather than the portal pushing because that is how Dash already handles requests: the
webhook is only a nudge, and Dash's 10-minute resync pulls again, so a lost webhook or a Dash
restart heals by itself and the portal needs no retry queue of its own.

## How the portal hears about a payment

All three paths run the same idempotent `applyCheckout`:

- **Webhook** `/api/pay/stripe`: signature checked over the raw body (HMAC-SHA256, 5-minute
  window), deduplicated by event id in `stripe_events`. A repeat answers 200 `duplicate`. If
  applying fails the event id is removed and the answer is 500, so Stripe's retry runs.
- **Return page**: Stripe sends the client to `/portal/billing?session=<id>`. The page asks Stripe
  about that session, but only if it belongs to one of this client's own online payments.
- **Reconcile**: `list_online_payments` (Dash's resync and its Billing page) asks Stripe about any
  online payment still `open` or `processing` from the last 30 days.

## Rules

- The amount comes from the invoices Dash sent (`amountCents - paidCents`), never from the request.
- One live payment page per client. Opening a new one first asks Stripe about any older open one
  (it may have just been paid in another tab), then closes it.
- A bank debit completes as "complete, unpaid": status `processing` until
  `checkout.session.async_payment_succeeded`. `async_payment_failed` sets `failed`, Billing says
  so, and the client can pay again. A failed debit stays failed when the session is read back
  later (it still says "complete, unpaid").
- Status `held` means money came in that is not passed to Dash: Stripe's amount differs from what
  the portal asked, the invoice was withdrawn in Dash (sent back as a draft or deleted), it was
  already paid, or another online payment already covers it. `problem` says why. Refund it in
  Stripe. Dash's Billing page shows these under "Paid online in the portal".
- An admin in View as client sees the Pay buttons disabled; the route refuses a preview anyway.
- `invoices.viewed_at` records the first time a client (not a preview) opened Billing while the
  invoice was sent. `upsert_invoice` never touches it.
- No Stripe key, or `APP_URL` not an http(s) address: no Pay buttons, and Billing shows the
  payment instructions as before.

## Setup (Lucca, in LMS's Stripe account)

Nothing here is done yet. Do it in test mode first (`sk_test_...`), then again in live mode.

1. **Settings, Payment methods**: turn on **Cards** (Apple Pay and Google Pay come with it) and
   **Canadian pre-authorized debits** (ACSS debit). If PAD is off, the portal falls back to cards
   alone without an error.
2. **Developers, Webhooks, Add endpoint**:
   `https://portal.londonmarketingsolutions.ca/api/pay/stripe`, with exactly these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`.
3. Server `.env` (`/srv/apps/lms-portal/.env`, chmod 600): `STRIPE_SECRET_KEY=sk_...` (a
   restricted key `rk_...` with Checkout Sessions write is fine) and
   `STRIPE_WEBHOOK_SECRET=whsec_...` from that endpoint. Restart `lms-portal`.
4. Network: the portal and its nginx site (`location /`, docs/deploy-home-server.md) have no path
   allowlist, so `/api/pay/stripe` is already reachable through the `lms` tunnel and needs no
   session. If a Cloudflare WAF or Access rule is ever put in front of the portal, exempt
   `POST /api/pay/stripe`. Check after deploying: an unsigned `curl -X POST` to it answers 400
   (404 means the keys are not set).

## Trying it locally

The tests (`tests/online-pay.test.ts`) run a small fake Stripe on a random port and play
Stripe's part: complete a session, sign a webhook, send the client back. For a click-through,
run `next dev` against a throwaway database with `STRIPE_API_BASE` pointing at a fake that also
serves a hosted checkout page (GET shows the buttons, POST marks the session paid, posts the
signed webhook and 303s to `success_url`), plus a local Dash with `PORTAL_URL` and a portal
token, so the import and the sync back run too. `next dev` keeps an SSE stream open, so wait for
`load`, not `networkidle`, in Playwright.

## Not covered

- Refunds and disputes are done in Stripe by hand; nothing here hears about them. After a refund,
  remove the payment in Dash.
- No payment reminders are sent from the portal.
