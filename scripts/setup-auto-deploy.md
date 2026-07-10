# Auto-deploy on push to main

Pushes to `main` deploy automatically to `https://www.tms.simple-source.com`.

## How it works

1. GitHub sends a signed webhook POST on every push to `main`.
2. The server receives it at `https://www.tms.simple-source.com/hooks/tms-deploy`.
3. The server runs `/var/www/tms/scripts/tms-deploy.sh`, which pulls latest code, migrates the database, rebuilds, and restarts PM2.

## One-time GitHub setup

In the GitHub repo, go to **Settings → Webhooks → Add webhook**:

| Field | Value |
|-------|-------|
| Payload URL | `https://www.tms.simple-source.com/hooks/tms-deploy` |
| Content type | `application/json` |
| Secret | Same value as in `/etc/webhook.conf` on the server |
| Events | Just the push event |
| Active | Checked |

The webhook only deploys when the push targets `main`.

## Server-side files

| Path | Purpose |
|------|---------|
| `/etc/webhook.conf` | Webhook listener config |
| `/usr/local/bin/tms-deploy.sh` | Symlink to repo deploy script |
| `/var/www/tms/scripts/tms-deploy.sh` | Deploy script from this repo |
| `/var/log/tms-deploy.log` | Deploy log |

## Manual deploy

```bash
ssh root@147.182.206.104
bash /var/www/tms/scripts/tms-deploy.sh
```

## Logs

```bash
tail -f /var/log/tms-deploy.log
```
