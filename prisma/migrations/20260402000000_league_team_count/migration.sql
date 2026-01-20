ALTER TABLE "League" ADD COLUMN "teamCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "League"
SET "teamCount" = sub.team_count
FROM (
  SELECT "leagueId" AS league_id, COUNT(*)::INTEGER AS team_count
  FROM "FantasyTeam"
  GROUP BY "leagueId"
) AS sub
WHERE "League"."id" = sub.league_id;
