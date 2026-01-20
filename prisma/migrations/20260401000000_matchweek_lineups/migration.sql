-- CreateTable
CREATE TABLE "TeamMatchWeekLineupSlot" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "rosterSlotId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "playerId" TEXT,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatchWeekLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchWeekLineupSlot_fantasyTeamId_matchWeekId_rosterSlotId_key" ON "TeamMatchWeekLineupSlot"("fantasyTeamId", "matchWeekId", "rosterSlotId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekLineupSlot_fantasyTeamId_matchWeekId_idx" ON "TeamMatchWeekLineupSlot"("fantasyTeamId", "matchWeekId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekLineupSlot_matchWeekId_idx" ON "TeamMatchWeekLineupSlot"("matchWeekId");

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_rosterSlotId_fkey" FOREIGN KEY ("rosterSlotId") REFERENCES "RosterSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
