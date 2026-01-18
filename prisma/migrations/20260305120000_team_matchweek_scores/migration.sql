-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "ScoreSource" AS ENUM ('STARTER', 'AUTO_SUB');

-- CreateTable
CREATE TABLE "TeamMatchWeekScore" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "ScoreStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatchWeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchWeekPlayerScore" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "source" "ScoreSource" NOT NULL DEFAULT 'STARTER',
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatchWeekPlayerScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchWeekScore_fantasyTeamId_matchWeekId_key" ON "TeamMatchWeekScore"("fantasyTeamId", "matchWeekId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekScore_matchWeekId_idx" ON "TeamMatchWeekScore"("matchWeekId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekScore_fantasyTeamId_idx" ON "TeamMatchWeekScore"("fantasyTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchWeekPlayerScore_fantasyTeamId_matchWeekId_playerId_key" ON "TeamMatchWeekPlayerScore"("fantasyTeamId", "matchWeekId", "playerId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekPlayerScore_matchWeekId_idx" ON "TeamMatchWeekPlayerScore"("matchWeekId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekPlayerScore_fantasyTeamId_idx" ON "TeamMatchWeekPlayerScore"("fantasyTeamId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekPlayerScore_playerId_idx" ON "TeamMatchWeekPlayerScore"("playerId");

-- AddForeignKey
ALTER TABLE "TeamMatchWeekScore" ADD CONSTRAINT "TeamMatchWeekScore_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekScore" ADD CONSTRAINT "TeamMatchWeekScore_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekPlayerScore" ADD CONSTRAINT "TeamMatchWeekPlayerScore_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekPlayerScore" ADD CONSTRAINT "TeamMatchWeekPlayerScore_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekPlayerScore" ADD CONSTRAINT "TeamMatchWeekPlayerScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
