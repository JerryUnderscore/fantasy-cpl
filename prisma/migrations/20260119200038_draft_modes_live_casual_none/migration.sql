-- CreateEnum
CREATE TYPE "DraftMode_new" AS ENUM ('LIVE', 'CASUAL', 'NONE');

-- AlterTable
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "draftScheduledAt" TIMESTAMP(3);

-- AlterEnum
ALTER TABLE "League" ALTER COLUMN "draftMode" DROP DEFAULT;

ALTER TABLE "League"
ALTER COLUMN "draftMode"
TYPE "DraftMode_new"
USING (
  CASE
    WHEN "draftMode"::text = 'TIMED' THEN 'LIVE'
    WHEN "draftMode"::text = 'MANUAL' THEN 'CASUAL'
    WHEN "draftMode"::text = 'ASYNC' THEN 'CASUAL'
    WHEN "draftMode"::text IN ('LIVE','CASUAL','NONE') THEN "draftMode"::text
    ELSE 'CASUAL'
  END
)::"DraftMode_new";

ALTER TABLE "League" ALTER COLUMN "draftMode" SET DEFAULT 'CASUAL';

-- DropEnum
DROP TYPE "DraftMode";

-- RenameEnum
ALTER TYPE "DraftMode_new" RENAME TO "DraftMode";