-- Rename slotIndex -> slotNumber (only if slotIndex exists and slotNumber does not)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'RosterSlot'
      AND column_name  = 'slotIndex'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'RosterSlot'
      AND column_name  = 'slotNumber'
  )
  THEN
    ALTER TABLE "RosterSlot" RENAME COLUMN "slotIndex" TO "slotNumber";
  END IF;
END $$;

-- Add position column (default MID) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'RosterSlot'
      AND column_name  = 'position'
  )
  THEN
    ALTER TABLE "RosterSlot"
      ADD COLUMN "position" "PlayerPosition" NOT NULL DEFAULT 'MID'::"PlayerPosition";
  END IF;
END $$;

-- Drop old unique index on (fantasyTeamId, slotIndex) if it exists (names may vary)
DROP INDEX IF EXISTS "RosterSlot_fantasyTeamId_slotIndex_key";
DROP INDEX IF EXISTS "RosterSlot_fantasyTeamId_slotIndex_unique";
DROP INDEX IF EXISTS "RosterSlot_fantasyTeamId_slotIndex_idx";

-- Create the intended unique index on (fantasyTeamId, slotNumber) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'RosterSlot'
      AND indexname  = 'RosterSlot_fantasyTeamId_slotNumber_key'
  )
  THEN
    CREATE UNIQUE INDEX "RosterSlot_fantasyTeamId_slotNumber_key"
      ON "RosterSlot" ("fantasyTeamId", "slotNumber");
  END IF;
END $$;