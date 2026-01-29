import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type QueueBody = { playerIds?: unknown };

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: { select: { id: true, isActive: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: { leagueId_profileId: { leagueId, profileId: profile.id } },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: { id: true },
    });

    if (!draft) {
      return NextResponse.json({ draftId: null, queue: [] });
    }

    const queue = await prisma.draftQueueItem.findMany({
      where: { draftId: draft.id, fantasyTeamId: team.id },
      orderBy: { rank: "asc" },
      select: {
        id: true,
        rank: true,
        Player: {
          select: {
            id: true,
            name: true,
            jerseyNumber: true,
            position: true,
            club: { select: { shortName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      draftId: draft.id,
      queue: queue.map((item) => ({
        id: item.id,
        rank: item.rank,
        player: {
          id: item.Player.id,
          name: item.Player.name,
          jerseyNumber: item.Player.jerseyNumber,
          position: item.Player.position,
          club: item.Player.club?.shortName ?? null,
        },
      })),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/draft/queue error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as QueueBody | null;
    const rawPlayerIds = Array.isArray(body?.playerIds) ? body.playerIds : null;
    const playerIds = rawPlayerIds
      ? rawPlayerIds.filter((id): id is string => typeof id === "string")
      : null;

    if (!rawPlayerIds || !playerIds || playerIds.length !== rawPlayerIds.length) {
      return NextResponse.json({ error: "playerIds required" }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(playerIds));
    if (uniqueIds.length !== playerIds.length) {
      return NextResponse.json(
        { error: "Duplicate playerIds" },
        { status: 400 },
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: { select: { id: true, isActive: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: { leagueId_profileId: { leagueId, profileId: profile.id } },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: { id: true },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not started" }, { status: 409 });
    }

    if (uniqueIds.length) {
      const players = await prisma.player.findMany({
        where: {
          id: { in: uniqueIds },
          seasonId: league.season.id,
          active: true,
          draftPicks: { none: { draftId: draft.id } },
        },
        select: { id: true },
      });

      if (players.length !== uniqueIds.length) {
        return NextResponse.json(
          { error: "Queue contains invalid players" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.draftQueueItem.deleteMany({
        where: { draftId: draft.id, fantasyTeamId: team.id },
      });

      if (!uniqueIds.length) return;

      await tx.draftQueueItem.createMany({
        data: uniqueIds.map((playerId, index) => ({
          id: crypto.randomUUID(),
          draftId: draft.id,
          fantasyTeamId: team.id,
          playerId,
          rank: index + 1,
          updatedAt: new Date(),
        })),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/leagues/[leagueId]/draft/queue error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
