#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
BRANCH="main"
LOG_FILE="/var/log/tms-deploy.log"
PM2_APP="tms"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

exec >> "$LOG_FILE" 2>&1
echo "=== Deploy started $(date) ==="

cd "$APP_DIR"

# Stop the app before touching SQLite or rebuilding.
pm2 stop "$PM2_APP" 2>/dev/null || true

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# NODE_ENV=production causes npm ci to skip devDependencies (prisma CLI, typescript, dotenv).
npm ci --include=dev
npx prisma generate
python3 prisma/production-membership-migrate.py 2>/dev/null || true
npx prisma db push --accept-data-loss
NODE_ENV=production npm run build
pm2 start "$PM2_APP" 2>/dev/null || pm2 restart "$PM2_APP"

echo "=== Deploy finished $(date) ==="
