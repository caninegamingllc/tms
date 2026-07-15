#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/tms"
cd "$APP_DIR"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
exec npx tsx scripts/job-worker.ts
