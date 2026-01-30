import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { computeCurrentPick } from "@/lib/draft";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    const user = await requireSupabaseUser();

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

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

    const team = await prisma.fantasyTeam.findUnique({
      where: { leagueId_profileId: { leagueId, profileId: profile.id } },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const [league, pendingTrades, pendingWaivers] = await Promise.all([
      prisma.league.findUnique({
        where: { id: leagueId },
        select: {
          id: true,
          seasonId: true,
          draftMode: true,
          season: { select: { isActive: true } },
        },
      }),
      prisma.trade.count({
        where: {
          leagueId,
          offeredToTeamId: team.id,
          status: "PENDING",
        },
      }),
      prisma.leagueWaiverClaim.count({
        where: {
          leagueId,
          fantasyTeamId: team.id,
          status: "PENDING",
        },
      }),
    ]);

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const draft = await prisma.draft.findUnique({
      where: { leagueId_seasonId: { leagueId, seasonId: league.seasonId } },
      select: { id: true, status: true, rounds: true },
    });

    let showDraft = false;
    let onClock = false;

    if (league.season.isActive && league.draftMode !== "NONE" && draft) {
      const teamCount = await prisma.fantasyTeam.count({ where: { leagueId } });
      const totalPicks = draft.rounds * teamCount;
      const pickedCount = await prisma.draftPick.count({
        where: { draftId: draft.id },
      });
      const isComplete = draft.status === "COMPLETE" || pickedCount >= totalPicks;
      showDraft = !isComplete;

      if (draft.status === "LIVE") {
        const [teams, picks] = await Promise.all([
          prisma.fantasyTeam.findMany({
            where: { leagueId },
            select: { id: true, name: true, profileId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          }),
          prisma.draftPick.findMany({
            where: { draftId: draft.id },
            select: { pickNumber: true, fantasyTeamId: true },
            orderBy: { pickNumber: "asc" },
          }),
        ]);

        const currentPick = computeCurrentPick(teams, picks, draft.rounds);
        onClock = currentPick?.fantasyTeamId === team.id;
      }
    }

    return NextResponse.json({
      pendingTrades,
      pendingWaivers,
      showDraft,
      onClock,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/nav-state error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
