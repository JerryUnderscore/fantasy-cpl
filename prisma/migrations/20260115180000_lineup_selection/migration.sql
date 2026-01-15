-- AlterTable
ALTER TABLE "RosterSlot" ADD COLUMN "isStarter" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "RosterSlot_fantasyTeamId_playerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_fantasyTeamId_playerId_key" ON "RosterSlot"("fantasyTeamId", "playerId");
