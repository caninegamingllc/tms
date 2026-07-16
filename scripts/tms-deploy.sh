#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
BRANCH="main"
LOG_FILE="/var/log/tms-deploy.log"
LOCK_FILE="/var/lock/tms-deploy.lock"
PM2_APP="tms"
PM2_WORKER="tms-worker"
BUILD_DIR=".next-build"

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

ensure_app_running() {
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP" --update-env || pm2 start npm --name "$PM2_APP" -- start
  else
    pm2 start npm --name "$PM2_APP" -- start
  fi

  if pm2 describe "$PM2_WORKER" >/dev/null 2>&1; then
    pm2 restart "$PM2_WORKER" --update-env || true
  else
    pm2 start "$APP_DIR/scripts/tms-worker.sh" --name "$PM2_WORKER" || true
  fi

  pm2 save >/dev/null 2>&1 || true
}

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

# Build into a staging directory so a live `.next` is never overwritten mid-request.
rm -rf "$BUILD_DIR"
if ! NEXT_DIST_DIR="$BUILD_DIR" NODE_ENV=production NODE_OPTIONS="--max-old-space-size=4096" NEXT_DISABLE_TURBOPACK=1 npm run build; then
  echo "=== Build failed $(date) — keeping previous .next and ensuring PM2 is up ==="
  ensure_app_running
  exit 1
fi

# Atomic swap: only replace `.next` after a successful build.
rm -rf .next-prev
if [[ -d .next ]]; then
  mv .next .next-prev
fi
mv "$BUILD_DIR" .next
rm -rf .next-prev

ensure_app_running

echo "=== Deploy finished $(date) ==="
