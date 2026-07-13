#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
CSV_PATH="/var/www/tms/tmp/ascend-loads.csv"
KEY_PATH="$HOME/.ssh/tms-deploy-key"

pm2 stop tms

cd "$APP_DIR"
cp prisma/dev.db "prisma/dev.db.pre-ascend-import-$(date +%Y%m%d%H%M%S)"

npm run db:import-ascend -- --csv "$CSV_PATH"

pm2 start tms

echo "Import finished"
