# One login for the portal and LMS Dash

Everyone signs in on the portal's **Sign in** page with an email and a password. Nobody picks
"client" or "team": the account decides where they land.

- **Client account**: their portal (`/portal`).
- **Agency admin** (Lucca, Evan): LMS Dash, already signed in.

## How it works

1. An admin signs in here. `homePath()` (`src/lib/auth/home.ts`) sends admins to `/sso/dash`
   when `DASH_URL` is set.
2. `/sso/dash` (`src/app/sso/dash/route.ts`) makes a one-time token (2 minutes, works once,
   only its sha256 is stored in `sso_links`) and redirects to `<DASH_URL>/sso?t=<token>`.
3. Dash calls `redeem_sso_link {token}` over MCP with its own admin API token. The tool returns
   the admin's email and name, or fails when the token is unknown, used, expired, or belongs to
   someone who is no longer an active admin of the same agency.
4. Dash maps the email to its account (`LMS_SSO_MAP`) and starts its own session.

Clients never get a token, so they can't reach Dash. A client who opens the Dash address is sent
to this sign-in page and then to their own portal. An admin who opens the portal is sent on to
Dash (`/admin` redirects to `/sso/dash`). To see the client side, admins use **View as client**
inside Dash, never a second login.

Signing out of Dash ends the portal session too: Dash sends the browser to `/logout` here.

## Settings

| Where | Name | Value |
|---|---|---|
| Portal `.env` | `DASH_URL` | Dash as browsers see it, `https://dash.londonmarketingsolutions.ca`. Unset = admins land on `/admin` (which still follows `ADMIN_HOME_URL`) |
| Dash `.env` | `PORTAL_PUBLIC_URL` | The portal as browsers see it, `https://portal.londonmarketingsolutions.ca` |
| Dash `.env` | `LMS_SSO_MAP` | `email:account` pairs, comma separated, e.g. `lucca.marketingsolutions@gmail.com:lucca` |
| Dash `.env` | `PORTAL_URL`, `PORTAL_TOKEN` | Already set for the portal link (docs/portal-sync.md in Dash) |

Every admin who should get into Dash needs an active `agency_admin` account here and a line in
`LMS_SSO_MAP`.

## When the portal is down

Dash's `/login?local=1` is its old password sign-in, kept as the way in. A failed token also lands
there (`?sso=failed`), so a broken portal never loops the browser.

## Into a client's job dashboard

A client whose company has the job dashboard (mikedash, one installation per company) gets
**Open your dashboard** in their side menu. It goes through `/sso/dashboard` here:

1. `dashboardSignInUrl()` (`src/lib/data/dashboard-sso.ts`) makes a one-time token for that
   client user (2 minutes, works once, only its sha256 stored in `dashboard_sso_links`, bound to
   their client) and redirects to `<dashboard_url>/dashboard/sso?t=<token>`.
2. The dashboard POSTs `{token}` to `/api/dashboard-sso/redeem` here with
   `Authorization: Bearer <its secret>`. Each dashboard has its own secret, made with the MCP tool
   `set_client_dashboard_sign_in` and stored here only as `clients.dashboard_sso_secret_hash`.
3. The answer is the person's email and name, or one 401 for everything else: unknown, used or
   expired token, a secret that is not that client's, or a user no longer active for that client.
   The token is burnt on the first try, right or wrong.
4. The dashboard starts its own session for the account with that email, or shows its login page.

An admin in View as client, or a client whose dashboard has no secret yet, is sent to the plain
dashboard address and signs in there. Turning sign-in off (`enabled: false`) or making a new
secret stops the old one working at once. Dashboard side: mikedash `src/lib/portal-sso.ts`.

## Tests

`tests/sso.test.ts` here (tokens, expiry, other agencies, clients refused, where each account
lands). Dash: `tests/test_sso.py`. The client dashboard: `tests/dashboard-sso.test.ts` here and
mikedash `tests/portal-sso.test.ts`.
