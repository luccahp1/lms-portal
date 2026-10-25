# Deploying to the home server

Instructions for deploying lms-portal to Lucca's home server (`luccaserver`, 10.0.0.78).
Written for a future Claude session that **has access to the server** (the
`lucca-home-server` skill / paramiko runner on lucca-mainpc). The session that built
Phase 1 could not reach the server, so none of this has been run yet.

> Follow the server's own rules (in the `lucca-home-server` skill): read
> `/srv/logs/server-glossary.md` and `/srv/logs/changelog.md` first, back up every config
> before editing it, never feed a heredoc through the `S` sudo helper, and log every
> change in the changelog (plus the glossary for new apps/ports/services).

## What gets installed

| Piece | Where | Notes |
|---|---|---|
| App code + build | `/srv/apps/lms-portal/` | Next.js standalone server (`node server.js`) |
| Secrets | `/srv/apps/lms-portal/.env` | chmod 600, owned by lucca |
| Uploaded files | Cloudflare R2 bucket `lms-portal-files` | off the box, so a dead HDD doesn't lose client files |
| Database | existing Postgres 16, new DB `lms_portal`, role `lms_portal` | 127.0.0.1:5432, same server PawSit uses |
| Service | `/etc/systemd/system/lms-portal.service` | binds **127.0.0.1:3010** only |
| Public access | nginx vhost + Cloudflare Tunnel hostname | **ask Lucca first**, see step 7 |

Expected RAM: ~150–250 MB for the Node process. Postgres is already running.

Node.js is allowed here as a justified exception (like atrio-bridge): the portal is a
React app and Lucca builds sites in Next.js. Next 15 needs Node **18.18+** (20 or 22
preferred). Check `node -v` on the server; atrio-bridge already uses Node.

## Steps

### 1. Check prerequisites

```bash
node -v; npm -v
psql --version
systemctl is-active postgresql nginx cloudflared
free -m
```

### 2. Create the database

Generate a strong password and store it only in the `.env` (and mirror it in
`/srv/.secrets/server-credentials.env` per the server's convention).

```bash
S(){ echo lucca | sudo -S -p '' "$@" 2>/dev/null; }
PW=$(openssl rand -base64 24 | tr -d '/+=')
cat > /tmp/lms.sql <<EOF
CREATE ROLE lms_portal LOGIN PASSWORD '$PW';
CREATE DATABASE lms_portal OWNER lms_portal;
EOF
S -u postgres psql -f /tmp/lms.sql
rm -f /tmp/lms.sql
echo "$PW"   # put this in .env in step 4, then clear your terminal
```

### 3. Create the Cloudflare R2 bucket (in the Cloudflare dashboard, done by Lucca)

Client files are stored in R2, not on the server's disk: the server has a single HDD with
no off-box backup, and R2's free tier (10 GB, no download fees) covers this easily.

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** → name `lms-portal-files`,
   location Automatic. Leave public access **off** (the portal hands out 5-minute signed
   download links itself).
2. R2 → **Manage API tokens** → **Create API token** → permission **Object Read & Write**,
   applied to **only** the `lms-portal-files` bucket.
3. Copy the **Access Key ID**, **Secret Access Key** and the **Account ID** (shown on the R2
   overview page). They go in the `.env` in step 5. The secret is shown only once.

No CORS setup is needed: uploads go through the portal server, and downloads are plain
redirects to signed links.

### 4. Get the code onto the server

Same approach as the other apps (deployed from lucca-mainpc). Either clone the repo on
the server or `git archive` from lucca-mainpc and copy it over:

```bash
mkdir -p /srv/apps/lms-portal
cd /srv/apps/lms-portal
git clone https://github.com/luccahp1/lms-portal.git src   # private repo: needs a deploy key or token
```

### 5. Configure

```bash
cat > /srv/apps/lms-portal/.env <<'EOF'
DATABASE_URL=postgres://lms_portal:<password from step 2>@127.0.0.1:5432/lms_portal
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<access key id>
R2_SECRET_ACCESS_KEY=<secret access key>
R2_BUCKET=lms-portal-files
APP_URL=https://<portal domain>
COOKIE_SECURE=true
EOF
chmod 600 /srv/apps/lms-portal/.env
```

Use `COOKIE_SECURE=false` only for LAN testing over plain http.

### 6. Build, migrate, create the first admin

```bash
cd /srv/apps/lms-portal/src
cp ../.env .env
npm ci
npm run build
npm run db:migrate
npm run create-admin -- "<Agency name>" "<Lucca's name>" <lucca's email>
# prints a one-time link: open it to set the admin password

# assemble the runnable bundle
rm -rf ../current && cp -r .next/standalone ../current
cp -r .next/static ../current/.next/static
cp -r public ../current/public
```

`npm run seed:demo` is for development only. Don't run it here.

Clients then sign up themselves: in the portal go to **Admin → Sign-ups**, copy the agency's
sign-up link, and send it to clients (or link it from the agency website). New accounts
wait for approval on that same page.

### 7. systemd service (ask Lucca before creating it)

Secrets come from `EnvironmentFile`, never from `ExecStart` arguments.

```bash
cat > /tmp/lms-portal.service <<'EOF'
[Unit]
Description=lms-portal (client portal, Next.js)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=lucca
WorkingDirectory=/srv/apps/lms-portal/current
EnvironmentFile=/srv/apps/lms-portal/.env
Environment=NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3010
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
MemoryMax=400M

[Install]
WantedBy=multi-user.target
EOF
S install -o root -g root -m 644 /tmp/lms-portal.service /etc/systemd/system/lms-portal.service
rm -f /tmp/lms-portal.service
S systemctl daemon-reload
S systemctl enable --now lms-portal
systemctl status lms-portal --no-pager
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3010/login   # expect 200
```

Check `which node` and adjust `ExecStart` if Node isn't at `/usr/bin/node`.

### 8. Make it reachable (ask Lucca first: this exposes a service publicly)

Recommended: a new hostname on the existing **Cloudflare Tunnel** (like pawsit.ca), e.g.
`portal.<agency domain>`, pointing at nginx, with an nginx server block that proxies to
127.0.0.1:3010.

**Hard constraints when touching nginx:**
- Back up first: `S cp -r /etc/nginx /srv/backups/nginx.$(date +%Y%m%d-%H%M%S).bak`
- Add a **new** server block; don't edit or trim the existing ones.
- `/atrio-bridge/` (the phone line) and `/co-skip` must keep working. Verify both with a
  real curl afterwards.
- Test with `S nginx -t 2>&1 | grep -v '^\[sudo'` before reloading.

```nginx
server {
    listen 80;
    server_name portal.<agency domain>;
    client_max_body_size 26m;   # uploads are capped at 25 MB in the app

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

For LAN/Tailscale-only testing first, skip the tunnel and reach it via an SSH port
forward or a LAN-only nginx listen. Don't open a new UFW port without asking.

### 9. Backups

Add to `/srv/scripts/backup.sh` (back it up first):
- `pg_dump -Fc lms_portal` alongside the PawSit dump

Uploaded files are in R2, so they're already off the box. The database dump still lives only
on the server (open item #1: nothing is copied off the box yet). It's small, so copying it to
R2 or lucca-mainpc nightly is cheap.

### 10. Log it

Append to `/srv/logs/changelog.md` (what was installed, the port, the service, the nginx
change) and add lms-portal to the glossary tables (app, service, bind 127.0.0.1:3010,
public hostname, DB, backup coverage).

## Updating later

```bash
cd /srv/apps/lms-portal/src && git pull && npm ci && npm run build && npm run db:migrate
rm -rf ../current && cp -r .next/standalone ../current && cp -r .next/static ../current/.next/static && cp -r public ../current/public
S systemctl restart lms-portal
```

## Moving off the home server later

The app only needs a Postgres URL, the R2 bucket and a Node runtime. Moving to
Supabase (as plain Postgres) + any Node host means changing `DATABASE_URL`, running
`npm run db:migrate` and restoring the `pg_dump`. Files are already in R2 and don't move.
