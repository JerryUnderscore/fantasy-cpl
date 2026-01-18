-- Add waiver settings to leagues
ALTER TABLE "League" ADD COLUMN "waiverPeriodHours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "LeaguePlayerWaiver" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "waiverAvailableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaguePlayerWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaguePlayerWaiver_leagueId_playerId_key" ON "LeaguePlayerWaiver"("leagueId", "playerId");

-- CreateIndex
CREATE INDEX "LeaguePlayerWaiver_leagueId_idx" ON "LeaguePlayerWaiver"("leagueId");

-- CreateIndex
CREATE INDEX "LeaguePlayerWaiver_playerId_idx" ON "LeaguePlayerWaiver"("playerId");

-- CreateIndex
CREATE INDEX "LeaguePlayerWaiver_leagueId_waiverAvailableAt_idx" ON "LeaguePlayerWaiver"("leagueId", "waiverAvailableAt");

-- AddForeignKey
ALTER TABLE "LeaguePlayerWaiver" ADD CONSTRAINT "LeaguePlayerWaiver_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaguePlayerWaiver" ADD CONSTRAINT "LeaguePlayerWaiver_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
