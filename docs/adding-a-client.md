# Adding a client

A new client now starts in LMS Dash, on the **Pipeline**: the team's step list from the first call
to a live site (lms-dash `docs/onboarding.md`). This page is the portal's half of it. Every step
can also be done over MCP ([mcp.md](mcp.md)); the tool `new_client_guide` returns a short version.

## 1. Create the client and send the start link

- Dash: New lead, then **Make the start link** on the client's Onboarding page. It creates the
  portal client and gives you the link with a message to send. Nothing is emailed.
- MCP: `create_client`, then `create_start_link { clientId, contactName }`.

The link is `/start/<token>`: personal, good for 30 days, and a new one replaces an unused old
one. Only its hash is stored (`start_links`). Without logging in, the client:

1. **Picks a design.** The ten site designs (`src/templates/`, listed in `src/lib/templates.ts`)
   show with their own business name and phone on them. They open any of them full size, on a
   computer or phone frame, choose one and say what they like about it.
2. **Answers "About your business".** The questions are `src/lib/intake.ts` (LMS Dash's intake
   sheet in plain words). Answers save when a field is left.
3. **Creates their portal login.** The account is active at once: we sent this link to this
   client, so there is no approval step. The link is then spent.

Picked a design together in a meeting? Record it in Dash (**Picked in the meeting**) or with
`save_intake`. The public gallery is `/templates` (add `?name=&phone=&city=` to personalise it).

After that the same things live on the client's **Your project** page (`/portal/project`).

The old way still works: the agency sign-up link (`/join/<code>`) plus approving the sign-up, or
`create_client_user` for a one-time set-password link.

## 2. The project card

`clients.stage` (discovery, design, build, review, launched) is pushed from LMS Dash with
`set_client_stage`. While it is one of the first four, the client's Overview shows **Your website
project**: five steps and the one thing they can do next. It disappears at `launched`, and never
shows for clients whose stage is empty (everyone from before this existed).

## 3. While building: the preview site

Set the build's address with `set_review_source` (Dash: **Connect the preview site**). The
client's **Request website changes** button opens it with the markup tools
([website-changes.md](website-changes.md)). Clear it at launch and the tool uses `websiteUrl`.

## 4. Fill it before telling them it is ready

- To-dos for anything only they can do (`save_todo`; Dash sends a starter set).
- This month's update (`upsert_monthly_note`) and work already done (`add_work_log`).
- Real invoices, analytics (`set_stats_source`), rankings and AI answers from LMS Dash.
- Brand kit files (`upload_file` with `folder: "brand"`).

Messages, request comments, files, to-dos and non-draft invoices show up for the client straight
away, so agree on wording before sending them.

## 4b. Link their job dashboard, if they have one

Clients who also have the job dashboard (leads, estimates, invoices, FieldKit; one installation
per company, see mikedash `docs/NEW-CLIENT.md`) get an **Open your dashboard** link in their
portal's side menu.

- Admin: client Settings → Job dashboard → paste the address → Save.
- MCP: `set_client_dashboard { clientId, dashboardUrl }`. An empty string removes the link.

It has to be an `https://` address. On its own the link opens the dashboard's login page.

To have the link sign them straight in, turn on one-click sign-in: MCP
`set_client_dashboard_sign_in { clientId, enabled: true }` returns a secret, once. Put it in that
dashboard's `.env.local` as `OE_PORTAL_SSO_SECRET` (with `OE_PORTAL_URL` set to this portal) and
restart it. The client's portal email must be the email on their dashboard account. How it works:
docs/sso.md, "Into a client's job dashboard".

## 5. Check it as the client

**View as client** in LMS Dash opens the portal exactly as the client's first user sees it,
read-only (a banner marks it, every form is disabled). It also opens the review tool: a request's
**See them on the site** link in Dash goes to `/preview/<token>?next=/review?request=<id>`.

## How the preview works

`requireClient()` in `src/lib/auth/session.ts` returns a client viewer built by `previewViewer()`
(`src/lib/data/preview.ts`) for an admin with the `lms_preview` cookie, or for a preview session
opened from LMS Dash. Server actions never use it, and the review and intake data functions
refuse any viewer with `previewBy` set, so a preview can't act as the client.
