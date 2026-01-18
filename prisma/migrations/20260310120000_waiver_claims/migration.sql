-- CreateEnum
CREATE TYPE "WaiverClaimStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "LeagueWaiverPriority" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueWaiverPriority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueWaiverClaim" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dropPlayerId" TEXT,
    "status" "WaiverClaimStatus" NOT NULL DEFAULT 'PENDING',
    "priorityNumberAtSubmit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "LeagueWaiverClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueWaiverPriority_leagueId_fantasyTeamId_key" ON "LeagueWaiverPriority"("leagueId", "fantasyTeamId");

-- CreateIndex
CREATE INDEX "LeagueWaiverPriority_leagueId_idx" ON "LeagueWaiverPriority"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueWaiverPriority_leagueId_priority_idx" ON "LeagueWaiverPriority"("leagueId", "priority");

-- CreateIndex
CREATE INDEX "LeagueWaiverClaim_leagueId_status_idx" ON "LeagueWaiverClaim"("leagueId", "status");

-- CreateIndex
CREATE INDEX "LeagueWaiverClaim_leagueId_playerId_status_idx" ON "LeagueWaiverClaim"("leagueId", "playerId", "status");

-- CreateIndex
CREATE INDEX "LeagueWaiverClaim_leagueId_fantasyTeamId_status_idx" ON "LeagueWaiverClaim"("leagueId", "fantasyTeamId", "status");

-- AddForeignKey
ALTER TABLE "LeagueWaiverPriority" ADD CONSTRAINT "LeagueWaiverPriority_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverPriority" ADD CONSTRAINT "LeagueWaiverPriority_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverClaim" ADD CONSTRAINT "LeagueWaiverClaim_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverClaim" ADD CONSTRAINT "LeagueWaiverClaim_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverClaim" ADD CONSTRAINT "LeagueWaiverClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverClaim" ADD CONSTRAINT "LeagueWaiverClaim_dropPlayerId_fkey" FOREIGN KEY ("dropPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
