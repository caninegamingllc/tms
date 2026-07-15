-- AlterTable
ALTER TABLE "Company" ADD COLUMN "customerPaymentUrl" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "paymentUrl" TEXT;

-- AlterTable
ALTER TABLE "LoadStop" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geocodedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CheckCall" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geocodedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerPortalUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPortalLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Share link',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPortalSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "portalUserId" TEXT,
    "portalLinkId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalUser_inviteTokenHash_key" ON "CustomerPortalUser"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CustomerPortalUser_customerId_idx" ON "CustomerPortalUser"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPortalUser_companyId_idx" ON "CustomerPortalUser"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalUser_companyId_email_key" ON "CustomerPortalUser"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalLink_tokenHash_key" ON "CustomerPortalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerPortalLink_customerId_idx" ON "CustomerPortalLink"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPortalLink_companyId_idx" ON "CustomerPortalLink"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalSession_tokenHash_key" ON "CustomerPortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerPortalSession_customerId_idx" ON "CustomerPortalSession"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPortalSession_portalUserId_idx" ON "CustomerPortalSession"("portalUserId");

-- CreateIndex
CREATE INDEX "CustomerPortalSession_portalLinkId_idx" ON "CustomerPortalSession"("portalLinkId");

-- AddForeignKey
ALTER TABLE "CustomerPortalUser" ADD CONSTRAINT "CustomerPortalUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalUser" ADD CONSTRAINT "CustomerPortalUser_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalLink" ADD CONSTRAINT "CustomerPortalLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalLink" ADD CONSTRAINT "CustomerPortalLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSession" ADD CONSTRAINT "CustomerPortalSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSession" ADD CONSTRAINT "CustomerPortalSession_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "CustomerPortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSession" ADD CONSTRAINT "CustomerPortalSession_portalLinkId_fkey" FOREIGN KEY ("portalLinkId") REFERENCES "CustomerPortalLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
