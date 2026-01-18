-- CreateEnum
CREATE TYPE "MatchWeekStatus" AS ENUM ('OPEN', 'LOCKED', 'FINALIZED');

-- AlterTable
ALTER TABLE "MatchWeek"
ADD COLUMN "status" "MatchWeekStatus" NOT NULL DEFAULT 'OPEN'::"MatchWeekStatus",
ADD COLUMN "lockAt" TIMESTAMP(3),
ADD COLUMN "finalizedAt" TIMESTAMP(3);

UPDATE "MatchWeek"
SET "status" = CASE
  WHEN "isLocked" THEN 'LOCKED'::"MatchWeekStatus"
  ELSE 'OPEN'::"MatchWeekStatus"
END;

-- AlterTable
ALTER TABLE "MatchWeek" DROP COLUMN "isLocked";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MatchWeek_seasonId_status_idx" ON "MatchWeek"("seasonId", "status");