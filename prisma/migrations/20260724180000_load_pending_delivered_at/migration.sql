-- AlterTable
ALTER TABLE "Load" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- Backfill deliveredAt for loads already past delivery
UPDATE "Load"
SET "deliveredAt" = COALESCE("deliveredAt", "deliveryDate")
WHERE status IN ('DELIVERED', 'INVOICED', 'PAID')
  AND "deliveredAt" IS NULL;

-- Align status pills with dispatch board: uncovered AVAILABLE → PENDING
UPDATE "Load"
SET status = 'PENDING'
WHERE status = 'AVAILABLE'
  AND NOT EXISTS (
    SELECT 1
    FROM "DispatchAssignment" da
    WHERE da."loadId" = "Load".id
      AND (
        da."carrierId" IS NOT NULL
        OR da."driverId" IS NOT NULL
        OR da."truckId" IS NOT NULL
        OR da."trailerId" IS NOT NULL
      )
  );

-- Covered loads with assignment → DISPATCHED
UPDATE "Load"
SET status = 'DISPATCHED'
WHERE status = 'COVERED'
  AND EXISTS (
    SELECT 1
    FROM "DispatchAssignment" da
    WHERE da."loadId" = "Load".id
      AND (
        da."carrierId" IS NOT NULL
        OR da."driverId" IS NOT NULL
        OR da."truckId" IS NOT NULL
        OR da."trailerId" IS NOT NULL
      )
  );
