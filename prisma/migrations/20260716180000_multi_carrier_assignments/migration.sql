-- Multi-carrier: allow multiple DispatchAssignment rows per load with O/D fields

-- Drop unique constraint on loadId (Postgres default name from Prisma)
DROP INDEX IF EXISTS "DispatchAssignment_loadId_key";

-- Sequence + free-form origin/destination for carrier legs
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "originFacilityName" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "originCity" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "originState" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "originPostalCode" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "destinationFacilityName" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "destinationCity" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "destinationState" TEXT;
ALTER TABLE "DispatchAssignment" ADD COLUMN IF NOT EXISTS "destinationPostalCode" TEXT;

CREATE INDEX IF NOT EXISTS "DispatchAssignment_loadId_idx" ON "DispatchAssignment"("loadId");
CREATE UNIQUE INDEX IF NOT EXISTS "DispatchAssignment_loadId_sequence_key" ON "DispatchAssignment"("loadId", "sequence");

-- Rate confirmations can target a specific assignment
ALTER TABLE "LoadDocument" ADD COLUMN IF NOT EXISTS "assignmentId" TEXT;
CREATE INDEX IF NOT EXISTS "LoadDocument_assignmentId_idx" ON "LoadDocument"("assignmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoadDocument_assignmentId_fkey'
  ) THEN
    ALTER TABLE "LoadDocument"
      ADD CONSTRAINT "LoadDocument_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "DispatchAssignment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
