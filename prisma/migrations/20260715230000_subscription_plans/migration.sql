-- AlterTable
ALTER TABLE "SeatSubscription" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'FREE';

-- Existing active (or past-due) seat purchases keep full access as Premium.
UPDATE "SeatSubscription"
SET
  "plan" = 'PREMIUM',
  "seatQuantity" = CASE
    WHEN "seatQuantity" < 1 THEN 999
    ELSE "seatQuantity"
  END
WHERE "status" IN ('ACTIVE', 'PAST_DUE')
  AND ("stripeSubscriptionId" IS NOT NULL OR "seatQuantity" > 0);

-- Everyone else starts on Free with a single seat so owners can use the trial TMS.
UPDATE "SeatSubscription"
SET
  "plan" = 'FREE',
  "seatQuantity" = 1,
  "status" = CASE
    WHEN "status" IS NULL OR "status" = 'NONE' OR "status" = 'CANCELED' THEN 'ACTIVE'
    ELSE "status"
  END
WHERE "plan" = 'FREE';
