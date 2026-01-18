-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'POSTPONED', 'COMPLETED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Match" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Match" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Match" SET "externalId" = "id" WHERE "externalId" IS NULL;

ALTER TABLE "Match"
  ALTER COLUMN "status" TYPE "MatchStatus"
  USING (
    CASE
      WHEN "status" IN ('SCHEDULED', 'POSTPONED', 'COMPLETED', 'CANCELED')
        THEN "status"::"MatchStatus"
      ELSE 'SCHEDULED'::"MatchStatus"
    END
  );

ALTER TABLE "Match" ALTER COLUMN "externalId" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Match_seasonId_kickoffAt_homeClubId_awayClubId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Match_seasonId_externalId_key" ON "Match"("seasonId", "externalId");
CREATE INDEX "Match_seasonId_kickoffAt_homeClubId_awayClubId_idx" ON "Match"("seasonId", "kickoffAt", "homeClubId", "awayClubId");
