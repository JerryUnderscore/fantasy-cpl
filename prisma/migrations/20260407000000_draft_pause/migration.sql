-- Add pause metadata to drafts
ALTER TABLE "Draft"
ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pausedRemainingSeconds" INTEGER;
