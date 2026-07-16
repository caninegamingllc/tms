-- Phase 2: IFTA worksheets, DVIR, settlements, CSA/HOS, ELD asset fields

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaUnsafeDriving" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaHosCompliance" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaVehicleMaint" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaControlledSub" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaDriverFitness" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "csaCrashIndicator" DOUBLE PRECISION;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "hosStatusSummary" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "hosLastSyncedAt" TIMESTAMP(3);

ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "eldAssetId" TEXT;
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "eldProvider" TEXT;
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "eldLastLocation" TEXT;
ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "eldLastPingAt" TIMESTAMP(3);

ALTER TABLE "IftaQuarter" ADD COLUMN IF NOT EXISTS "filedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "IftaTrip" (
    "id" TEXT NOT NULL,
    "quarterId" TEXT NOT NULL,
    "truckId" TEXT,
    "driverId" TEXT,
    "loadId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "jurisdiction" TEXT NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaTrip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IftaFuelPurchase" (
    "id" TEXT NOT NULL,
    "quarterId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "gallons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "truckId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaFuelPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DvirReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT,
    "truckId" TEXT,
    "trailerId" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectionType" TEXT NOT NULL DEFAULT 'PRE_TRIP',
    "result" TEXT NOT NULL DEFAULT 'SATISFACTORY',
    "odometer" INTEGER,
    "defectsJson" TEXT,
    "remarks" TEXT,
    "certifiedSafe" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DvirReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DriverSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "loadId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "payMethod" TEXT NOT NULL DEFAULT 'FLAT',
    "miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "payCents" INTEGER NOT NULL DEFAULT 0,
    "deductionsCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IftaTrip_quarterId_idx" ON "IftaTrip"("quarterId");
CREATE INDEX IF NOT EXISTS "IftaTrip_quarterId_jurisdiction_idx" ON "IftaTrip"("quarterId", "jurisdiction");
CREATE INDEX IF NOT EXISTS "IftaTrip_truckId_idx" ON "IftaTrip"("truckId");

CREATE INDEX IF NOT EXISTS "IftaFuelPurchase_quarterId_idx" ON "IftaFuelPurchase"("quarterId");
CREATE INDEX IF NOT EXISTS "IftaFuelPurchase_quarterId_jurisdiction_idx" ON "IftaFuelPurchase"("quarterId", "jurisdiction");

CREATE INDEX IF NOT EXISTS "DvirReport_companyId_idx" ON "DvirReport"("companyId");
CREATE INDEX IF NOT EXISTS "DvirReport_companyId_inspectedAt_idx" ON "DvirReport"("companyId", "inspectedAt");
CREATE INDEX IF NOT EXISTS "DvirReport_truckId_idx" ON "DvirReport"("truckId");
CREATE INDEX IF NOT EXISTS "DvirReport_driverId_idx" ON "DvirReport"("driverId");

CREATE INDEX IF NOT EXISTS "DriverSettlement_companyId_idx" ON "DriverSettlement"("companyId");
CREATE INDEX IF NOT EXISTS "DriverSettlement_companyId_status_idx" ON "DriverSettlement"("companyId", "status");
CREATE INDEX IF NOT EXISTS "DriverSettlement_driverId_idx" ON "DriverSettlement"("driverId");
CREATE INDEX IF NOT EXISTS "DriverSettlement_loadId_idx" ON "DriverSettlement"("loadId");

ALTER TABLE "IftaTrip" DROP CONSTRAINT IF EXISTS "IftaTrip_quarterId_fkey";
ALTER TABLE "IftaTrip" ADD CONSTRAINT "IftaTrip_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "IftaQuarter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IftaTrip" DROP CONSTRAINT IF EXISTS "IftaTrip_truckId_fkey";
ALTER TABLE "IftaTrip" ADD CONSTRAINT "IftaTrip_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IftaTrip" DROP CONSTRAINT IF EXISTS "IftaTrip_driverId_fkey";
ALTER TABLE "IftaTrip" ADD CONSTRAINT "IftaTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IftaTrip" DROP CONSTRAINT IF EXISTS "IftaTrip_loadId_fkey";
ALTER TABLE "IftaTrip" ADD CONSTRAINT "IftaTrip_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IftaFuelPurchase" DROP CONSTRAINT IF EXISTS "IftaFuelPurchase_quarterId_fkey";
ALTER TABLE "IftaFuelPurchase" ADD CONSTRAINT "IftaFuelPurchase_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "IftaQuarter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DvirReport" DROP CONSTRAINT IF EXISTS "DvirReport_companyId_fkey";
ALTER TABLE "DvirReport" ADD CONSTRAINT "DvirReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DvirReport" DROP CONSTRAINT IF EXISTS "DvirReport_driverId_fkey";
ALTER TABLE "DvirReport" ADD CONSTRAINT "DvirReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DvirReport" DROP CONSTRAINT IF EXISTS "DvirReport_truckId_fkey";
ALTER TABLE "DvirReport" ADD CONSTRAINT "DvirReport_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DvirReport" DROP CONSTRAINT IF EXISTS "DvirReport_trailerId_fkey";
ALTER TABLE "DvirReport" ADD CONSTRAINT "DvirReport_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DriverSettlement" DROP CONSTRAINT IF EXISTS "DriverSettlement_companyId_fkey";
ALTER TABLE "DriverSettlement" ADD CONSTRAINT "DriverSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverSettlement" DROP CONSTRAINT IF EXISTS "DriverSettlement_driverId_fkey";
ALTER TABLE "DriverSettlement" ADD CONSTRAINT "DriverSettlement_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverSettlement" DROP CONSTRAINT IF EXISTS "DriverSettlement_loadId_fkey";
ALTER TABLE "DriverSettlement" ADD CONSTRAINT "DriverSettlement_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
