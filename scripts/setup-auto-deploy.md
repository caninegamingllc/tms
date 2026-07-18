# Auto-deploy on push to main

Pushes to `main` deploy automatically to `https://tms.simple-source.com`.

## How it works

1. GitHub sends a signed webhook POST on every push to `main`.
2. The server receives it at `https://tms.simple-source.com/hooks/tms-deploy`.
3. The server runs `/var/www/tms/scripts/tms-deploy.sh`, which pulls latest code, migrates the database, rebuilds, and restarts PM2.

## One-time GitHub setup

Already configured: GitHub Actions on push to `main` (Option A). Do not also add a repo webhook or every push will deploy twice.

### Option A: GitHub Actions (recommended — in use)

Repo secret `DEPLOY_WEBHOOK_SECRET` must match the HMAC secret in `/etc/webhook.conf` on the server.

**Settings → Secrets and variables → Actions → New repository secret** (only if missing/rotating):

| Name | Value |
|------|-------|
| `DEPLOY_WEBHOOK_SECRET` | The webhook secret from `/etc/webhook.conf` on the server |

After the secret is saved, every push to `main` runs the deploy workflow.

### Option B: GitHub repository webhook

In the GitHub repo, go to **Settings → Webhooks → Add webhook**:

| Field | Value |
|-------|-------|
| Payload URL | `https://tms.simple-source.com/hooks/tms-deploy` |
| Content type | `application/json` |
| Secret | Same value as in `/etc/webhook.conf` on the server |
| Events | Just the push event |
| Active | Checked |

The webhook only deploys when the push targets `main`.

## Server-side files

| Path | Purpose |
|------|---------|
| `/etc/webhook.conf` | Webhook listener config |
| `/etc/nginx/sites-available/tms.simple-source.com` | nginx reverse proxy (HTTPS via certbot) |
| `/usr/local/bin/tms-deploy.sh` | Symlink to repo deploy script |
| `/var/www/tms/scripts/tms-deploy.sh` | Deploy script from this repo (must stay mode `100755` / executable) |
| `/var/log/tms-deploy.log` | Deploy log |

Webhook should invoke the script via `/bin/bash /usr/local/bin/tms-deploy.sh` (or the script must remain executable). A `git reset --hard` otherwise strips `+x` when the file is tracked as `100644`, and later webhook triggers return HTTP 200 without running a deploy.

## Manual deploy / SSH

Prefer push to `main`. SSH only for ops/debug (local `~/.ssh/config` host `tms` → `tms-prod.pem`):

```bash
ssh tms
bash /var/www/tms/scripts/tms-deploy.sh
```

## Logs

```bash
ssh tms "tail -f /var/log/tms-deploy.log"
```

## Production host

Current production droplet IP: `159.65.39.111` (`tms.simple-source.com`).

Local SSH `Host tms` in `~/.ssh/config` must use that same IP, or deploy-log checks will hit the wrong box.

After migrating droplets:

1. Point GoDaddy A records for `tms` / `www` at the new public IP.
2. Update local `Host tms` `HostName` to match.
3. Confirm `/etc/webhook.conf` secret matches GitHub Actions `DEPLOY_WEBHOOK_SECRET`.
4. Verify: `dig +short tms.simple-source.com` and `ssh -G tms | grep '^hostname '` agree.
