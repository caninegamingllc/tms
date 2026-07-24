-- CreateTable
CREATE TABLE "CarrierDriver" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarrierDriver_carrierId_idx" ON "CarrierDriver"("carrierId");

-- AddForeignKey
ALTER TABLE "CarrierDriver" ADD CONSTRAINT "CarrierDriver_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
