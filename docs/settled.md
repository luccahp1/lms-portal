# Invoicing (Settled) in the client portal

Settled is LMS's invoicing product: invoices that mark themselves paid when an Interac e-Transfer,
card payment or cheque comes in. In the portal it is a **paid add-on** under **Invoicing** in the
client's left nav. Off, the page shows what it does, a live demo and an **Ask us to switch it on**
button. On, the client gets the whole Settled app inside the portal.

## How it fits together

```
client's browser ──> portal /portal/invoicing/...        (pages: src/app/portal/invoicing, UI: src/settled)
                 └─> portal /portal/invoicing/api/<path>  (proxy: src/app/portal/invoicing/api/[...path]/route.ts)
                          └─> Settled engine SETTLED_URL/api/v1/<path>   with the client's owner key
customers ───────────────> Settled's own PUBLIC_URL /pay/<token>, /account/<token>  (links in invoice emails)
```

- **Settled stays its own service** (repo `luccahp1/settled`, `C:\Projects\settled`). It reads the
  client's Gmail or forwarded Interac emails, checks Interac's DKIM signature, talks to Stripe,
  matches payments and sends invoice emails. One Settled installation holds every client's business.
- **Each portal client is one Settled business.** `clients.settled_org_id` and
  `clients.settled_api_key` link them. The key is an owner key (`stl_live_...`). It is a secret: it
  is never in `clientColumns`, never sent to a browser, and only `settledTarget()` reads it, for the proxy.
- **The proxy** finds the key from the signed-in viewer, never from the request, so a client can
  only reach their own business. `/portal/invoicing/api/me` maps to Settled's `/api/auth/me`;
  everything else to `/api/v1/...`. "View as client" can read but not write. Writes from another
  site are refused.
- **The screens** in `src/settled` are ported from the Settled app (`settled/src/app`). They use
  Settled's motion and layout, and `src/settled/styles/bridge.css` maps their colours and fonts
  onto the LMS kit so they follow the portal's look and light/dark theme. All their CSS is scoped
  under `.stl`, so it cannot touch the rest of the portal. Dialogs, the search palette and toasts
  render into a `div#stl-layer.stl` on `<body>`.
- Not in the portal (the portal already does these): Settled's sign-in, team, API keys and
  account tabs, and "Load sample data" (it would mix fake records into a client's real books).

## Switching it on for a client

1. The client needs a portal login: their first active login becomes the Settled business owner,
   so payment and "needs a look" emails reach them.
2. Switch it on: LMS Dash's portal link or Claude via the `lms-portal` MCP tool
   `set_client_invoicing { clientId, enabled: true }`, or the old admin page (client, Settings,
   **Invoicing (Settled)**). The first time, the portal signs the business up in Settled (client
   name, owner email, a random password nobody uses) and makes the owner key.
3. The client opens **Invoicing**, then **Setup**, and connects their Gmail or forwarding,
   e-Transfer email, tax, Stripe if they want cards.

Switching it off locks the page and the proxy again; the Settled business and everything in it stay.
On again picks it back up without making a new one. A client asking from the locked page files a
portal request titled "Switch on Invoicing (Settled)" (once; asking again while it is open does nothing new).

## Settings

| Setting | Where | What |
|---|---|---|
| `SETTLED_URL` | portal `.env` | Where the portal reaches the Settled engine, e.g. `http://127.0.0.1:3123`. Empty: Invoicing shows "being set up" even when switched on. |
| `PUBLIC_URL` | Settled `.env.local` | Settled's public https address. Pay links in invoice emails point here, so it must be reachable by the client's customers. |

## Trying it locally

```bash
# Settled, trusting unsigned sample notices (local only)
cd C:\Projects\settled && npm run setup -- --yes
SETTLED_TRUST_UNSIGNED=1 npm run dev -- -p 3123
# Portal (embedded Postgres as in HANDOFF.md), then seed and switch it on
SETTLED_URL=http://localhost:3123 npm run dev
npm run seed:demo        # client@demo.test / demo-password
# MCP: set_client_invoicing { clientId, enabled: true }
# Watch an invoice go Incoming, then Paid, while it is open in the portal:
cd C:\Projects\settled
npm run notice -- --business "Sample Client" --from "MARCUS LEE" --amount 1073.50 --message INV-1007 --stage pending --ref CA1
npm run notice -- --business "Sample Client" --from "MARCUS LEE" --amount 1073.50 --message INV-1007 --stage deposited --ref CA1
```

Tests: `tests/settled.test.ts` (fake Settled on a local port): locked by default, switching on
makes the business with the client's login as owner, each client reaches only its own key, the key
never shows on a page, off/on keeps the business, a failed sign-up leaves it off, asking files one request.
