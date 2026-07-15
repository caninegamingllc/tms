#!/bin/bash
# Inspect production Postgres (run on the app host with DATABASE_URL set).
set -euo pipefail
cd /var/www/tms
echo "=== companies ==="
npx prisma db execute --stdin <<'SQL'
SELECT name, slug FROM "Company" ORDER BY name LIMIT 20;
SQL
echo "=== talent memberships sample ==="
npx prisma db execute --stdin <<'SQL'
SELECT u.name, u.email, b.name AS branch, m.role
FROM "CompanyMembership" m
JOIN "User" u ON u.id = m."userId"
LEFT JOIN "Branch" b ON b.id = m."branchId"
JOIN "Company" c ON c.id = m."companyId"
WHERE c.name ILIKE '%Talent%'
LIMIT 20;
SQL
