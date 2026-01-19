-- CreateTable
CREATE TABLE "DraftQueueItem" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftQueueItem_draftId_fantasyTeamId_playerId_key" ON "DraftQueueItem"("draftId", "fantasyTeamId", "playerId");

-- CreateIndex
CREATE INDEX "DraftQueueItem_draftId_fantasyTeamId_rank_idx" ON "DraftQueueItem"("draftId", "fantasyTeamId", "rank");

-- AddForeignKey
ALTER TABLE "DraftQueueItem" ADD CONSTRAINT "DraftQueueItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftQueueItem" ADD CONSTRAINT "DraftQueueItem_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftQueueItem" ADD CONSTRAINT "DraftQueueItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
