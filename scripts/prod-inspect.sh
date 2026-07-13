#!/bin/bash
set -euo pipefail
cd /var/www/tms
echo "=== git ==="
git log -1 --oneline
echo "=== db ==="
ls -la prisma/dev.db
sqlite3 prisma/dev.db "SELECT name FROM Company;"
echo "=== TTL users ==="
sqlite3 prisma/dev.db "SELECT u.name, u.email, b.name, m.role FROM CompanyMembership m JOIN User u ON u.id=m.userId LEFT JOIN Branch b ON b.id=m.branchId JOIN Company c ON c.id=m.companyId WHERE c.name LIKE '%Talent%';"
echo "=== load count ==="
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Load l JOIN Company c ON c.id=l.companyId WHERE c.name LIKE '%Talent%';"
