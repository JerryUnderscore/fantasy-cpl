-- CreateEnum
CREATE TYPE "StandingsMode" AS ENUM ('TOTAL_POINTS', 'HEAD_TO_HEAD');

-- AddColumn
ALTER TABLE "League" ADD COLUMN "standingsMode" "StandingsMode" NOT NULL DEFAULT 'TOTAL_POINTS';
