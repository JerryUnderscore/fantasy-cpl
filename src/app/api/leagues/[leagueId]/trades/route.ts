import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type TradePayload = {
  offeredToTeamId?: string;
  sendPlayerIds?: string[];
  receivePlayerIds?: string[];
  parentTradeId?: string | null;
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const normalizeIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];

export async function GET(_: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const trades = await prisma.trade.findMany({
      where: {
        leagueId,
        OR: [
          { offeredByTeamId: team.id },
          { offeredToTeamId: team.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        offeredByTeam: {
          select: { id: true, name: true, profile: { select: { displayName: true } } },
        },
        offeredToTeam: {
          select: { id: true, name: true, profile: { select: { displayName: true } } },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            direction: true,
            player: {
              select: {
                id: true,
                name: true,
                jerseyNumber: true,
                position: true,
                club: { select: { shortName: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ teamId: team.id, trades });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/trades error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as TradePayload | null;
    const offeredToTeamId =
      typeof body?.offeredToTeamId === "string" ? body.offeredToTeamId : null;
    const sendPlayerIds = normalizeIds(body?.sendPlayerIds);
    const receivePlayerIds = normalizeIds(body?.receivePlayerIds);
    const parentTradeId =
      typeof body?.parentTradeId === "string" ? body.parentTradeId : null;

    if (!offeredToTeamId) {
      return NextResponse.json(
        { error: "offeredToTeamId is required" },
        { status: 400 },
      );
    }

    if (offeredToTeamId === team.id) {
      return NextResponse.json(
        { error: "Cannot trade with your own team" },
        { status: 400 },
      );
    }

    if (sendPlayerIds.length === 0 || receivePlayerIds.length === 0) {
      return NextResponse.json(
        { error: "Trades must include players from both teams" },
        { status: 400 },
      );
    }

    if (sendPlayerIds.length !== receivePlayerIds.length) {
      return NextResponse.json(
        { error: "Trades must exchange the same number of players" },
        { status: 400 },
      );
    }

    const allIds = new Set([...sendPlayerIds, ...receivePlayerIds]);
    if (allIds.size !== sendPlayerIds.length + receivePlayerIds.length) {
      return NextResponse.json(
        { error: "Players cannot be included multiple times" },
        { status: 400 },
      );
    }

    const offeredToTeam = await prisma.fantasyTeam.findFirst({
      where: { id: offeredToTeamId, leagueId },
      select: { id: true },
    });

    if (!offeredToTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (parentTradeId) {
      const parentTrade = await prisma.trade.findFirst({
        where: { id: parentTradeId, leagueId },
        select: { id: true, status: true, offeredByTeamId: true, offeredToTeamId: true },
      });

      if (!parentTrade || parentTrade.status !== "PENDING") {
        return NextResponse.json(
          { error: "Parent trade is not open" },
          { status: 409 },
        );
      }

      if (
        parentTrade.offeredByTeamId !== team.id &&
        parentTrade.offeredToTeamId !== team.id
      ) {
        return NextResponse.json(
          { error: "Not authorized to counter this trade" },
          { status: 403 },
        );
      }
    }

    const myRoster = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: team.id, playerId: { in: sendPlayerIds } },
      select: { playerId: true },
    });

    if (myRoster.length !== sendPlayerIds.length) {
      return NextResponse.json(
        { error: "One or more offered players are no longer on your roster" },
        { status: 409 },
      );
    }

    const theirRoster = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: offeredToTeamId, playerId: { in: receivePlayerIds } },
      select: { playerId: true },
    });

    if (theirRoster.length !== receivePlayerIds.length) {
      return NextResponse.json(
        { error: "One or more requested players are no longer on that roster" },
        { status: 409 },
      );
    }

    const trade = await prisma.$transaction(async (tx) => {
      const created = await tx.trade.create({
        data: {
          leagueId,
          offeredByTeamId: team.id,
          offeredToTeamId,
          parentTradeId: parentTradeId ?? null,
        },
      });

      const items = [
        ...sendPlayerIds.map((playerId) => ({
          tradeId: created.id,
          playerId,
          direction: "FROM_OFFERING" as const,
        })),
        ...receivePlayerIds.map((playerId) => ({
          tradeId: created.id,
          playerId,
          direction: "FROM_RECEIVING" as const,
        })),
      ];

      await tx.tradeItem.createMany({ data: items });

      if (parentTradeId) {
        await tx.trade.update({
          where: { id: parentTradeId },
          data: { status: "COUNTERED" },
        });
      }

      return created;
    });

    return NextResponse.json({ tradeId: trade.id });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/trades error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
