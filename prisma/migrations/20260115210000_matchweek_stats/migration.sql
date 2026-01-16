-- CreateTable
CREATE TABLE "MatchWeek" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStat" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerMatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchWeek_seasonId_idx" ON "MatchWeek"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchWeek_seasonId_number_key" ON "MatchWeek"("seasonId", "number");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_matchWeekId_idx" ON "PlayerMatchStat"("matchWeekId");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_playerId_idx" ON "PlayerMatchStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStat_playerId_matchWeekId_key" ON "PlayerMatchStat"("playerId", "matchWeekId");

-- AddForeignKey
ALTER TABLE "MatchWeek" ADD CONSTRAINT "MatchWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStat" ADD CONSTRAINT "PlayerMatchStat_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
