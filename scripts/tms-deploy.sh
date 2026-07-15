#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
BRANCH="main"
LOG_FILE="/var/log/tms-deploy.log"
LOCK_FILE="/var/lock/tms-deploy.lock"
PM2_APP="tms"
PM2_WORKER="tms-worker"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

exec >> "$LOG_FILE" 2>&1

# Serialize stacked webhooks so concurrent resets/builds cannot race.
exec 9>"$LOCK_FILE"
if ! flock -w 1800 9; then
  echo "=== Deploy skipped $(date) — could not acquire lock within 30m ==="
  exit 1
fi

echo "=== Deploy started $(date) ==="

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Keep the hook target executable after hard reset (git file mode 100755).
chmod +x "$APP_DIR/scripts/tms-deploy.sh"
chmod +x "$APP_DIR/scripts/tms-worker.sh" 2>/dev/null || true

# NODE_ENV=production causes npm ci to skip devDependencies (prisma CLI, typescript, dotenv).
npm ci --include=dev
npx prisma generate

# Prefer migrate deploy; DATABASE_URL must point at Postgres (not SQLite).
# Use DATABASE_URL (direct) for migrations; app uses DATABASE_POOL_URL when set.
if [[ -n "${DATABASE_MIGRATE_URL:-}" ]]; then
  DATABASE_URL="$DATABASE_MIGRATE_URL" npx prisma migrate deploy
else
  npx prisma migrate deploy
fi

NODE_ENV=production NODE_OPTIONS="--max-old-space-size=4096" NEXT_DISABLE_TURBOPACK=1 npm run build

# Rolling restart: bring app back before (or without) a hard stop when already running.
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP" --update-env
else
  pm2 start npm --name "$PM2_APP" -- start
fi

if pm2 describe "$PM2_WORKER" >/dev/null 2>&1; then
  pm2 reload "$PM2_WORKER" --update-env
else
  pm2 start "$APP_DIR/scripts/tms-worker.sh" --name "$PM2_WORKER"
fi

pm2 save >/dev/null 2>&1 || true

echo "=== Deploy finished $(date) ==="
