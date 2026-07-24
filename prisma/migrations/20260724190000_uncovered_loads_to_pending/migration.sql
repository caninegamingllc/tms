-- Uncovered non-terminal loads → PENDING
-- Coverage = any carrier assignment, OR primary (sequence 0) with both driver and truck
UPDATE "Load"
SET status = 'PENDING'
WHERE status NOT IN ('INVOICED', 'PAID', 'CANCELED', 'PENDING')
  AND NOT EXISTS (
    SELECT 1
    FROM "DispatchAssignment" da
    WHERE da."loadId" = "Load".id
      AND da."carrierId" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "DispatchAssignment" da
    WHERE da."loadId" = "Load".id
      AND da.sequence = 0
      AND da."driverId" IS NOT NULL
      AND da."truckId" IS NOT NULL
  );
