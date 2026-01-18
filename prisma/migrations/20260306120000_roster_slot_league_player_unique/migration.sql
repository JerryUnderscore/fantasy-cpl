-- AddColumn
ALTER TABLE "RosterSlot" ADD COLUMN "leagueId" TEXT;

-- Backfill leagueId from FantasyTeam
UPDATE "RosterSlot"
SET "leagueId" = "FantasyTeam"."leagueId"
FROM "FantasyTeam"
WHERE "RosterSlot"."fantasyTeamId" = "FantasyTeam"."id";

-- Ensure leagueId is set
ALTER TABLE "RosterSlot" ALTER COLUMN "leagueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "RosterSlot_leagueId_idx" ON "RosterSlot"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_leagueId_playerId_key" ON "RosterSlot"("leagueId", "playerId");

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
