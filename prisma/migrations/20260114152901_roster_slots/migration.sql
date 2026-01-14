-- CreateTable
CREATE TABLE "RosterSlot" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterSlot_fantasyTeamId_idx" ON "RosterSlot"("fantasyTeamId");

-- CreateIndex
CREATE INDEX "RosterSlot_fantasyTeamId_playerId_idx" ON "RosterSlot"("fantasyTeamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_fantasyTeamId_slotIndex_key" ON "RosterSlot"("fantasyTeamId", "slotIndex");

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
