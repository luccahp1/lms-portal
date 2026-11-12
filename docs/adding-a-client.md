# Adding a client

How to put a new client on the portal, check it the way they will see it, and hand it over.
Every step can be done in the admin pages or through the MCP endpoint ([mcp.md](mcp.md)). The
MCP tool `new_client_guide` returns a short version of this list with the live sign-up link, and
the server's instructions tell AI clients to call it before onboarding anyone.

## 1. Create the client

Check the client isn't there already (Admin → Clients, or `get_overview`), then create it.

- Admin: Clients → New client.
- MCP: `create_client` with `name`, `websiteUrl` and `planName`. The result includes the new
  client's `id` and `previewUrl`.

## 2. Get the owner logged in

Nothing is emailed yet, so send the agency sign-up link yourself (Admin → Sign-ups, or
`signUpLink` from `get_overview`). The owner signs up with their own email and password and lands
on a waiting page.

## 3. Approve the sign-up into the client

- Admin: Sign-ups → pick the client from step 1 → Approve.
- MCP: `list_pending_signups`, then `approve_signup` with `userId` and the `clientId` from step 1.

Approve into the existing client. Choosing "new client" (or `newClientName`) creates a second,
empty client with the same name.

**Or skip the sign-up link** and create the login yourself: client Settings → Add a login directly, or
`create_client_user { clientId, email, name }`. You get a one-time link (14 days) where they choose
their own password. Send it to them; nothing is emailed.

If someone can't get in later, make them a one-time password link (client Settings → Reset link,
or `create_password_reset_link`) and send it to them.

## 4. Fill it before their first login

An empty portal makes a poor first impression. At minimum:

- This month's update: wins, what we're working on, what's next (`upsert_monthly_note`).
- Work already done, one entry per item (`add_work_log`).
- Real invoices (`create_invoice`, or `upsert_invoice` by number). Drafts stay hidden from the client until marked sent.
- Website analytics: client Settings → Website analytics, or `set_stats_source` ([analytics.md](analytics.md)).
- Rankings and AI answers: pushed from LMS Dash (`sync_rankings`, `sync_ai_answers`).
- To-dos for anything only the client can do, with steps (client → To-dos tab, or `save_todo`).
- Brand kit: business card and logo files uploaded with **Brand kit** ticked (or `upload_file` with
  `folder: "brand"`). PNG/JPEG previews show on their Your brand page; PDFs are downloads.

Messages, request comments, files and non-draft invoices show up for the client straight away, so
agree on wording before sending them.

## 4b. Link their job dashboard, if they have one

Clients who also have the job dashboard (leads, estimates, invoices, FieldKit; one installation
per company, see mikedash `docs/NEW-CLIENT.md`) get an **Open your dashboard** link in their
portal's side menu.

- Admin: client Settings → Job dashboard → paste the address → Save.
- MCP: `set_client_dashboard { clientId, dashboardUrl }`. An empty string removes the link.

It has to be an `https://` address. It is a plain link: they sign in on the dashboard with their
dashboard login, which is separate from their portal login.

## 5. Check it as the client

Open the client in Admin and click **View as client** (top right). It opens the portal in a new tab
exactly as the client's first user sees it: their name, their nav badges, no draft invoices. Client
Settings has a **View as <name>** button per person when a client has more than one login. Before
anyone joins, the preview shows the client with a placeholder user.

The preview is look-only. A banner marks it, every form and button inside it is disabled, and
**Exit preview** takes you back to the client's admin page. Admin pages keep working normally in
other tabs while a preview is open; opening a preview for another client replaces the first one.

Over MCP, `get_client`, `get_overview` and `create_client` return a `previewUrl` for each client.
It only works in a browser that is logged in as an agency admin.

## How the preview works

`/admin/clients/<id>/preview` (optionally `?user=<id>`) checks the admin, sets an `lms_preview`
cookie and redirects to `/portal`. `requireClient()` in `src/lib/auth/session.ts` returns a client
viewer built by `previewViewer()` (`src/lib/data/preview.ts`) when the real viewer is an admin and
that cookie is set, so every portal page runs the same data-layer code a real client gets. Admin
pages and server actions never read the cookie, so a preview can't act as the client.
`/portal/exit-preview` clears it.
