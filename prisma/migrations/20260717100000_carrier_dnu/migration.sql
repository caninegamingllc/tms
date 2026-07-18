-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN "dnuAt" TIMESTAMP(3),
ADD COLUMN "dnuMarkedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_dnuMarkedByUserId_fkey" FOREIGN KEY ("dnuMarkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
