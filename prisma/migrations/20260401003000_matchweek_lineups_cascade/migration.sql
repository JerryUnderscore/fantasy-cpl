-- DropForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" DROP CONSTRAINT "TeamMatchWeekLineupSlot_fantasyTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" DROP CONSTRAINT "TeamMatchWeekLineupSlot_matchWeekId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" DROP CONSTRAINT "TeamMatchWeekLineupSlot_rosterSlotId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" DROP CONSTRAINT "TeamMatchWeekLineupSlot_playerId_fkey";

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_rosterSlotId_fkey" FOREIGN KEY ("rosterSlotId") REFERENCES "RosterSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekLineupSlot" ADD CONSTRAINT "TeamMatchWeekLineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
