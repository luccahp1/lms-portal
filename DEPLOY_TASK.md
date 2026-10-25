# One-time task: deploy the portal

## Status (2026-10-25)

Deployed and live at https://portal.londonmarketingsolutions.ca. Everything in "Done means"
is verified except the browser login: Lucca still has to open his set-password link (printed
by `create-admin` on 2026-10-25, valid 14 days) and confirm he can log in and sees the
sign-up link under Admin → Sign-ups. Once he has, delete this file as described at the bottom.

One change from the plan: londonmarketingsolutions.ca is on the LMS Cloudflare account and the
existing tunnel is on the personal one, so the portal runs through its own tunnel `lms` and a
`cloudflared-lms` unit (see docs/deploy-home-server.md step 8). The rate limit answers 429, not
503 (the server's `limit_req_status`). The end-to-end check ran against the live database and
R2 through the app's data layer, not through the browser forms.

> **This file is temporary.** It's a task for one Claude session. When the deployment is
> finished and verified, that session deletes this file (see "Last step" at the bottom).
> If you are a Claude session and Lucca pointed you here: this is your task.

---

You're deploying the London Marketing Solutions client portal ("lms-portal") to Lucca's
home server and setting up its file storage on Cloudflare R2. The app is already built and
tested. Your job is to get it running at https://portal.londonmarketingsolutions.ca.

## Where things are
- Repo: github.com/luccahp1/lms-portal (private). The code is in PR #1, branch `phase-1-mvp`.
  If PR #1 is merged, deploy `main`; otherwise deploy `phase-1-mvp`.
- Your step-by-step guide is `docs/deploy-home-server.md` in this repo. Follow it in order;
  it already contains every decision below. Read README.md for what the app is.
- Server: Lucca's home server (luccaserver, 10.0.0.78). Use the `lucca-home-server` skill
  for how to connect (the paramiko runner on lucca-mainpc) and for the server's rules.
  Before running anything, read /srv/logs/server-glossary.md and /srv/logs/changelog.md
  on the server.

## Decisions already made (don't revisit)
- Runs on the home server as one Node process (Next.js standalone) under systemd, bound to
  127.0.0.1:3010. Node is an accepted exception to the server's Python preference.
- Database: the server's existing Postgres 16, new database + role `lms_portal`.
- Client files: a private Cloudflare R2 bucket `lms-portal-files`, with an API token limited
  to that bucket (Object Read & Write). Nothing is stored on the server's disk.
- Public address: portal.londonmarketingsolutions.ca (domain already on Cloudflare), through
  the server's EXISTING Cloudflare Tunnel to nginx :80, then to 127.0.0.1:3010. No new UFW ports.
- Rate limiting on /login, /join/ and /reset/ in nginx (keyed on CF-Connecting-IP) before
  the hostname goes public. The config is in the guide.
- First admin: agency "London Marketing Solutions"; ask Lucca for his name and email.
- No email sending yet. Don't set up SMTP.

## What Lucca has to do himself (walk him through it, one step at a time)
1. Cloudflare dashboard: create the R2 bucket and API token (guide step 3), then give you the
   Account ID, Access Key ID and Secret. The secret goes ONLY into
   /srv/apps/lms-portal/.env (chmod 600) and /srv/.secrets/server-credentials.env.
   Never put it in a command line, the changelog, the glossary, the chat summary or this repo.
2. If the tunnel is dashboard-managed: add the public hostname in Zero Trust → Tunnels.
3. Open the admin setup link that `npm run create-admin` prints, and set his password.

## Ask Lucca before (the server's rules require it)
Creating the systemd service, any change in /etc/nginx/, changing the tunnel, and making
the hostname public. Back up every config before editing it.

## Hard constraints (from the server skill, repeated because they matter)
- /atrio-bridge/ in nginx is a live phone line, and /co-skip's public URL must not change.
  After ANY nginx or tunnel change, curl both and confirm pawsit.ca still loads.
- Never pipe a heredoc through the `S` sudo helper (write to /tmp, then `S install`).
- Never put secrets in ExecStart. Use EnvironmentFile.
- No Docker. Keep the service under its MemoryMax (400M).
- Log every change in /srv/logs/changelog.md, and add the app, service, port, hostname,
  database and R2 bucket to the glossary.

## Done means
- `systemctl status lms-portal` is active and survives a restart.
- https://portal.londonmarketingsolutions.ca/login returns 200 from outside, over https.
- Lucca can log in as admin. Admin → Sign-ups shows a sign-up link starting with
  https://portal.londonmarketingsolutions.ca/join/
- End-to-end test: sign up a test client with that link, approve it, log in as the client,
  upload a small file, download it (the download should redirect to
  *.r2.cloudflarestorage.com), then reject or remove the test account and delete the file.
- About 25 fast requests to /login start getting 503s (the rate limit works).
- /atrio-bridge/ and /co-skip still respond exactly as before, and pawsit.ca still loads.
- backup.sh also dumps the lms_portal database (guide step 9).
- The changelog and glossary are updated.

## Last step: remove this file

Do this only after **everything** in "Done means" is true:

1. On the branch you deployed from (`main`, or `phase-1-mvp` if PR #1 isn't merged yet):
   `git rm DEPLOY_TASK.md`, and delete the "Pending task" line pointing to it in README.md.
2. Commit with the message `Remove completed deploy task` and push.
3. Don't touch anything else in the repo in that commit.

If you can't finish (a blocker, or Lucca stops partway), **don't delete this file**. Instead,
add a short "Status" section at the top of this file saying what's done, what's left and
why, then commit and push that, so the next session can pick up where you stopped.

When you finish, give Lucca a short summary: the URL, what you changed on the server,
anything you couldn't do and why, and leftover follow-ups (for example, copying the
database backups off the server).
