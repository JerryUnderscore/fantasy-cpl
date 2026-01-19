import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import {
  computeCurrentPick,
  computePickDeadline,
  runDraftCatchUp,
} from "@/lib/draft";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

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
        draftMode: true,
        draftPickSeconds: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    await runDraftCatchUp({ leagueId });

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: {
        id: true,
        status: true,
        rounds: true,
        createdAt: true,
        currentPickStartedAt: true,
      },
    });

    if (!draft) {
      return NextResponse.json({
        status: "NOT_STARTED",
        settings: {
          draftMode: league.draftMode,
          draftPickSeconds: league.draftPickSeconds,
        },
      });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const picks = await prisma.draftPick.findMany({
      where: { draftId: draft.id },
      orderBy: { pickNumber: "asc" },
      include: {
        fantasyTeam: { select: { id: true, name: true } },
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            club: { select: { shortName: true } },
          },
        },
      },
    });

    const teamCount = teams.length;
    const totalPicks = teamCount ? draft.rounds * teamCount : 0;
    let computedStatus = draft.status;

    if (teamCount && picks.length >= totalPicks && totalPicks > 0) {
      computedStatus = "COMPLETE";
    }

    const onTheClock = computeCurrentPick(teams, picks, draft.rounds);
    const deadline = onTheClock
      ? computePickDeadline({
          draftStatus: computedStatus,
          draftMode: league.draftMode,
          draftPickSeconds: league.draftPickSeconds,
          currentPickStartedAt: draft.currentPickStartedAt,
          draftCreatedAt: draft.createdAt,
        })
      : null;

    return NextResponse.json({
      draft: {
        id: draft.id,
        status: computedStatus,
        rounds: draft.rounds,
        currentPickStartedAt: draft.currentPickStartedAt,
      },
      settings: {
        draftMode: league.draftMode,
        draftPickSeconds: league.draftPickSeconds,
      },
      picks: picks.map((pick) => ({
        id: pick.id,
        pickNumber: pick.pickNumber,
        round: pick.round,
        slotInRound: pick.slotInRound,
        fantasyTeamId: pick.fantasyTeamId,
        teamName: pick.fantasyTeam.name,
        player: {
          id: pick.player.id,
          name: pick.player.name,
          position: pick.player.position,
          club: pick.player.club?.shortName ?? null,
        },
      })),
      onTheClock,
      deadline: deadline ? deadline.toISOString() : null,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/draft error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
