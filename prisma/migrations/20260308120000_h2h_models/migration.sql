-- CreateEnum
CREATE TYPE "H2HResultStatus" AS ENUM ('PENDING', 'FINAL');

-- CreateTable
CREATE TABLE "LeagueMatchup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homePoints" INTEGER NOT NULL DEFAULT 0,
    "awayPoints" INTEGER NOT NULL DEFAULT 0,
    "resultStatus" "H2HResultStatus" NOT NULL DEFAULT 'PENDING',
    "winnerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMatchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueTeamRecord" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "pointsFor" INTEGER NOT NULL DEFAULT 0,
    "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
    "playedFinalized" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueTeamRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMatchup_leagueId_matchWeekId_homeTeamId_key" ON "LeagueMatchup"("leagueId", "matchWeekId", "homeTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMatchup_leagueId_matchWeekId_awayTeamId_key" ON "LeagueMatchup"("leagueId", "matchWeekId", "awayTeamId");

-- CreateIndex
CREATE INDEX "LeagueMatchup_leagueId_matchWeekId_idx" ON "LeagueMatchup"("leagueId", "matchWeekId");

-- CreateIndex
CREATE INDEX "LeagueMatchup_homeTeamId_idx" ON "LeagueMatchup"("homeTeamId");

-- CreateIndex
CREATE INDEX "LeagueMatchup_awayTeamId_idx" ON "LeagueMatchup"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTeamRecord_leagueId_fantasyTeamId_key" ON "LeagueTeamRecord"("leagueId", "fantasyTeamId");

-- CreateIndex
CREATE INDEX "LeagueTeamRecord_leagueId_idx" ON "LeagueTeamRecord"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueTeamRecord_fantasyTeamId_idx" ON "LeagueTeamRecord"("fantasyTeamId");

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "FantasyTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeamRecord" ADD CONSTRAINT "LeagueTeamRecord_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeamRecord" ADD CONSTRAINT "LeagueTeamRecord_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
