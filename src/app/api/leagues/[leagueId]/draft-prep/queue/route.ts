import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type QueueItem = { playerId: string; rank: number };

type QueueResponse = {
  draftId: string | null;
  items: QueueItem[];
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const getMembership = async (leagueId: string, profileId: string) =>
  prisma.leagueMember.findUnique({
    where: { leagueId_profileId: { leagueId, profileId } },
    select: { id: true },
  });

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getMembership(leagueId, profile.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
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
        leagueId_seasonId: { leagueId, seasonId: league.seasonId },
      },
      select: { id: true },
    });

    if (!draft) {
      const response: QueueResponse = { draftId: null, items: [] };
      return NextResponse.json(response);
    }

    const items = await prisma.draftQueueItem.findMany({
      where: { draftId: draft.id, fantasyTeamId: team.id },
      orderBy: { rank: "asc" },
      select: { playerId: true, rank: true },
    });

    const response: QueueResponse = { draftId: draft.id, items };
    return NextResponse.json(response);
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/draft-prep/queue error", error);
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

    const membership = await getMembership(leagueId, profile.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: { leagueId_profileId: { leagueId, profileId: profile.id } },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    let draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.seasonId },
      },
      select: { id: true },
    });

    if (!draft) {
      draft = await prisma.draft.create({
        data: {
          leagueId,
          seasonId: league.seasonId,
          status: "NOT_STARTED",
          rounds: 15,
          currentPickStartedAt: null,
          isPaused: false,
          pausedRemainingSeconds: null,
        },
        select: { id: true },
      });
    }

    const body = await request.json().catch(() => null);
    const queue = Array.isArray(body?.queue) ? body.queue : null;
    if (!queue) {
      return NextResponse.json({ error: "Invalid queue" }, { status: 400 });
    }

    const seen = new Set<string>();
    const orderedQueue: string[] = [];
    for (const value of queue) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      orderedQueue.push(trimmed);
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.draftQueueItem.deleteMany({
        where: { draftId: draft.id, fantasyTeamId: team.id },
      });

      if (orderedQueue.length > 0) {
        await tx.draftQueueItem.createMany({
          data: orderedQueue.map((playerId, index) => ({
            id: randomUUID(),
            draftId: draft.id,
            fantasyTeamId: team.id,
            playerId,
            rank: index + 1,
            updatedAt: now,
          })),
        });
      }
    });

    return NextResponse.json({ count: orderedQueue.length, draftId: draft.id });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/leagues/[leagueId]/draft-prep/queue error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
