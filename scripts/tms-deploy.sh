#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
BRANCH="main"
LOG_FILE="/var/log/tms-deploy.log"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

exec >> "$LOG_FILE" 2>&1
echo "=== Deploy started $(date) ==="

cd "$APP_DIR"

# Discard local edits from prior builds (e.g. next-env.d.ts, package-lock.json).
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart tms

echo "=== Deploy finished $(date) ==="
