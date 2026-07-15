/**
 * One-time SQLite → Postgres data copy for production cutover.
 *
 * Prerequisites:
 *   1. Postgres is migrated: `npx prisma migrate deploy`
 *   2. DATABASE_URL is postgresql://...
 *
 * Usage:
 *   SQLITE_PATH="prisma/dev.db" DATABASE_URL="postgresql://..." npx tsx scripts/migrate-sqlite-to-postgres.ts
 */
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const TABLES = [
  "Company",
  "User",
  "Branch",
  "CommissionProfile",
  "CompanyMembership",
  "MembershipBranch",
  "SeatSubscription",
  "Session",
  "AuditLog",
  "OAuthAccount",
  "UserMailbox",
  "CommodityOption",
  "CarrierPayLineType",
  "FactoringCompany",
  "Customer",
  "Carrier",
  "Facility",
  "Load",
  "LoadStop",
  "LoadCommodityLine",
  "LoadCharge",
  "CarrierPayLine",
  "DispatchAssignment",
  "CheckCall",
  "LoadDocument",
  "LoadNote",
  "LoadActivity",
  "CustomerActivity",
  "CarrierActivity",
  "CustomerContact",
  "CarrierContact",
  "CarrierInsuranceCoverage",
  "CarrierComplianceDocument",
  "Invoice",
  "CarrierBill",
  "Payment",
  "PaymentApplication",
  "LoadCommission",
  "IntegrationAccount",
  "AccountingExport",
  "EmailThread",
  "EmailMessage"
] as const;

function coerceValue(value: unknown) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH?.trim() || "prisma/dev.db";
  const pgUrl = process.env.DATABASE_URL?.trim();
  if (!pgUrl || pgUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must be a postgresql:// URL for the target database.");
  }

  const sqlite = new DatabaseSync(sqlitePath);
  const postgres = new PrismaClient({ datasourceUrl: pgUrl });

  console.log("Reading from SQLite:", sqlitePath);
  console.log("Writing to Postgres:", pgUrl.replace(/:[^:@/]+@/, ":***@"));

  for (const table of TABLES) {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
    } catch (error) {
      console.warn(`Skip read ${table}:`, error instanceof Error ? error.message : error);
      continue;
    }

    console.log(`${table}: ${rows.length} rows`);
    if (rows.length === 0) continue;

    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const values = cols.map((c) => coerceValue(row[c]));
      try {
        await postgres.$executeRawUnsafe(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          ...values
        );
      } catch (error) {
        console.warn(`Skip insert ${table}:`, error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  sqlite.close();
  await postgres.$disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
