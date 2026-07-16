-- Premium + Trucking fleet models and nullable carrier on dispatch assignment

-- AlterTable
ALTER TABLE "DispatchAssignment" ALTER COLUMN "carrierId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "employeeNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "cdlNumber" TEXT,
    "cdlClass" TEXT,
    "cdlState" TEXT,
    "cdlEndorsements" TEXT,
    "cdlExpiresAt" TIMESTAMP(3),
    "medicalExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "licensePlate" TEXT,
    "licenseState" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownership" TEXT NOT NULL DEFAULT 'COMPANY',
    "registrationExpiresAt" TIMESTAMP(3),
    "annualInspectionExpiresAt" TIMESTAMP(3),
    "irpExpiresAt" TIMESTAMP(3),
    "insuranceExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trailer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "licensePlate" TEXT,
    "licenseState" TEXT,
    "trailerType" TEXT NOT NULL DEFAULT 'Dry Van',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "registrationExpiresAt" TIMESTAMP(3),
    "annualInspectionExpiresAt" TIMESTAMP(3),
    "insuranceExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentMaintenanceLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workType" TEXT NOT NULL DEFAULT 'PM',
    "odometer" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverQualificationItem" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "filePath" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverQualificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT,
    "truckId" TEXT,
    "trailerId" TEXT,
    "loadId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'ACCIDENT',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "dotRecordable" BOOLEAN NOT NULL DEFAULT false,
    "claimNumber" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaQuarter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaQuarter_pkey" PRIMARY KEY ("id")
);

-- AlterTable DispatchAssignment — add fleet FKs
ALTER TABLE "DispatchAssignment" ADD COLUMN "driverId" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN "truckId" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN "trailerId" TEXT;

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");
CREATE INDEX "Driver_companyId_status_idx" ON "Driver"("companyId", "status");
CREATE UNIQUE INDEX "Driver_companyId_employeeNumber_key" ON "Driver"("companyId", "employeeNumber");

CREATE INDEX "Truck_companyId_idx" ON "Truck"("companyId");
CREATE INDEX "Truck_companyId_status_idx" ON "Truck"("companyId", "status");
CREATE UNIQUE INDEX "Truck_companyId_unitNumber_key" ON "Truck"("companyId", "unitNumber");

CREATE INDEX "Trailer_companyId_idx" ON "Trailer"("companyId");
CREATE INDEX "Trailer_companyId_status_idx" ON "Trailer"("companyId", "status");
CREATE UNIQUE INDEX "Trailer_companyId_unitNumber_key" ON "Trailer"("companyId", "unitNumber");

CREATE INDEX "EquipmentMaintenanceLog_companyId_idx" ON "EquipmentMaintenanceLog"("companyId");
CREATE INDEX "EquipmentMaintenanceLog_companyId_assetType_assetId_idx" ON "EquipmentMaintenanceLog"("companyId", "assetType", "assetId");

CREATE INDEX "DriverQualificationItem_driverId_idx" ON "DriverQualificationItem"("driverId");
CREATE INDEX "DriverQualificationItem_driverId_category_idx" ON "DriverQualificationItem"("driverId", "category");

CREATE INDEX "SafetyEvent_companyId_idx" ON "SafetyEvent"("companyId");
CREATE INDEX "SafetyEvent_companyId_occurredAt_idx" ON "SafetyEvent"("companyId", "occurredAt");
CREATE INDEX "SafetyEvent_driverId_idx" ON "SafetyEvent"("driverId");

CREATE UNIQUE INDEX "IftaQuarter_companyId_year_quarter_key" ON "IftaQuarter"("companyId", "year", "quarter");
CREATE INDEX "IftaQuarter_companyId_idx" ON "IftaQuarter"("companyId");

CREATE INDEX "DispatchAssignment_carrierId_idx" ON "DispatchAssignment"("carrierId");
CREATE INDEX "DispatchAssignment_driverId_idx" ON "DispatchAssignment"("driverId");
CREATE INDEX "DispatchAssignment_truckId_idx" ON "DispatchAssignment"("truckId");
CREATE INDEX "DispatchAssignment_trailerId_idx" ON "DispatchAssignment"("trailerId");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trailer" ADD CONSTRAINT "Trailer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentMaintenanceLog" ADD CONSTRAINT "EquipmentMaintenanceLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverQualificationItem" ADD CONSTRAINT "DriverQualificationItem_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IftaQuarter" ADD CONSTRAINT "IftaQuarter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
