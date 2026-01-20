-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('FREE_AGENT', 'WAIVER');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'COUNTERED');

-- CreateEnum
CREATE TYPE "TradeItemDirection" AS ENUM ('FROM_OFFERING', 'FROM_RECEIVING');

-- CreateTable
CREATE TABLE "TeamMatchWeekTransfer" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "matchWeekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMatchWeekTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "offeredByTeamId" TEXT NOT NULL,
    "offeredToTeamId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "parentTradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "direction" "TradeItemDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMatchWeekTransfer_fantasyTeamId_matchWeekId_idx" ON "TeamMatchWeekTransfer"("fantasyTeamId", "matchWeekId");

-- CreateIndex
CREATE INDEX "TeamMatchWeekTransfer_leagueId_matchWeekId_idx" ON "TeamMatchWeekTransfer"("leagueId", "matchWeekId");

-- CreateIndex
CREATE INDEX "Trade_leagueId_status_idx" ON "Trade"("leagueId", "status");

-- CreateIndex
CREATE INDEX "Trade_offeredByTeamId_idx" ON "Trade"("offeredByTeamId");

-- CreateIndex
CREATE INDEX "Trade_offeredToTeamId_idx" ON "Trade"("offeredToTeamId");

-- CreateIndex
CREATE INDEX "TradeItem_tradeId_direction_idx" ON "TradeItem"("tradeId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TradeItem_tradeId_playerId_key" ON "TradeItem"("tradeId", "playerId");

-- AddForeignKey
ALTER TABLE "TeamMatchWeekTransfer" ADD CONSTRAINT "TeamMatchWeekTransfer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekTransfer" ADD CONSTRAINT "TeamMatchWeekTransfer_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekTransfer" ADD CONSTRAINT "TeamMatchWeekTransfer_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchWeekTransfer" ADD CONSTRAINT "TeamMatchWeekTransfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_offeredByTeamId_fkey" FOREIGN KEY ("offeredByTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_offeredToTeamId_fkey" FOREIGN KEY ("offeredToTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_parentTradeId_fkey" FOREIGN KEY ("parentTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
