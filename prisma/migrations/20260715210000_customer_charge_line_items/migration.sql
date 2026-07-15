-- CreateTable
CREATE TABLE "CustomerChargeType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationMethod" TEXT NOT NULL DEFAULT 'FLAT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerChargeType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerChargeType_companyId_idx" ON "CustomerChargeType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerChargeType_companyId_name_key" ON "CustomerChargeType"("companyId", "name");

-- AddForeignKey
ALTER TABLE "CustomerChargeType" ADD CONSTRAINT "CustomerChargeType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "LoadCharge" ADD COLUMN "lineTypeId" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "unitRateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill unit rate from existing amounts (quantity stays 1)
UPDATE "LoadCharge" SET "unitRateCents" = "amountCents" WHERE "unitRateCents" = 0 AND "amountCents" <> 0;

-- CreateIndex
CREATE INDEX "LoadCharge_loadId_idx" ON "LoadCharge"("loadId");

-- CreateIndex
CREATE INDEX "LoadCharge_lineTypeId_idx" ON "LoadCharge"("lineTypeId");

-- AddForeignKey
ALTER TABLE "LoadCharge" ADD CONSTRAINT "LoadCharge_lineTypeId_fkey" FOREIGN KEY ("lineTypeId") REFERENCES "CustomerChargeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: lineTypeId is nullable so system Late Fee rows can omit a catalog type.

-- Seed default customer charge types for every company
INSERT INTO "CustomerChargeType" ("id", "companyId", "name", "calculationMethod", "active", "sortOrder", "isSystem", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || c."id" || t.ord::text),
  c."id",
  t.name,
  t.method,
  true,
  t.ord,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
  VALUES
    (0, 'Flat Rate', 'FLAT'),
    (1, 'Rate per Mile', 'PER_MILE'),
    (2, 'Hourly', 'HOURLY'),
    (3, 'Detention', 'HOURLY'),
    (4, 'Truck Ordered Not Used', 'FLAT')
) AS t(ord, name, method);

-- Link existing non–late-fee charges to Flat Rate for their company
UPDATE "LoadCharge" AS lc
SET "lineTypeId" = cct."id",
    "label" = CASE WHEN lc."label" = 'Linehaul' THEN 'Flat Rate' ELSE lc."label" END,
    "chargeType" = CASE WHEN lc."chargeType" = 'Linehaul' THEN 'Flat Rate' ELSE lc."chargeType" END
FROM "Load" l
JOIN "CustomerChargeType" cct
  ON cct."companyId" = l."companyId"
 AND cct."name" = 'Flat Rate'
WHERE lc."loadId" = l."id"
  AND lc."chargeType" <> 'Late Fee'
  AND lc."lineTypeId" IS NULL;
