import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { computeTeamMatchWeekScore, buildScoreBreakdown } from "@/lib/scoring-persist";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;
    const matchWeekParam = request.nextUrl.searchParams.get("matchWeek");
    const matchWeekNumber = matchWeekParam ? Number(matchWeekParam) : 1;

    if (!Number.isInteger(matchWeekNumber) || matchWeekNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid matchWeek" },
        { status: 400 },
      );
    }

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

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const matchWeek = await prisma.matchWeek.findUnique({
      where: {
        seasonId_number: {
          seasonId: league.seasonId,
          number: matchWeekNumber,
        },
      },
      select: { id: true, number: true, status: true },
    });

    if (!matchWeek) {
      return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const persistedScore = await prisma.teamMatchWeekScore.findUnique({
      where: {
        fantasyTeamId_matchWeekId: {
          fantasyTeamId: team.id,
          matchWeekId: matchWeek.id,
        },
      },
      select: { points: true },
    });

    if (persistedScore) {
      const playerScores = await prisma.teamMatchWeekPlayerScore.findMany({
        where: { fantasyTeamId: team.id, matchWeekId: matchWeek.id },
        select: {
          playerId: true,
          points: true,
          breakdown: true,
          player: {
            select: {
              name: true,
              jerseyNumber: true,
              position: true,
              club: { select: { slug: true } },
            },
          },
        },
      });

      const breakdown = playerScores.map((score) => {
        const breakdown = buildScoreBreakdown(score.breakdown);
        return {
          playerId: score.playerId,
          playerName: score.player?.name ?? "Unknown",
          jerseyNumber: score.player?.jerseyNumber ?? null,
          position: score.player?.position ?? "MID",
          clubSlug: score.player?.club?.slug ?? null,
          minutes: breakdown.minutes,
          points: score.points,
          components: breakdown.components,
        };
      });

      return NextResponse.json({
        ok: true,
        leagueId,
        matchWeek,
        team,
        totalPoints: persistedScore.points,
        startersCount: breakdown.length,
        breakdown,
        provisional: matchWeek.status !== "FINALIZED",
      });
    }

    const computed = await computeTeamMatchWeekScore(team.id, matchWeek.id);
    const breakdown = computed.playerResults.map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      jerseyNumber: entry.jerseyNumber ?? null,
      position: entry.position,
      clubSlug: entry.clubSlug,
      minutes: entry.breakdown.minutes,
      points: entry.points,
      components: entry.breakdown.components,
    }));

    return NextResponse.json({
      ok: true,
      leagueId,
      matchWeek,
      team,
      totalPoints: computed.totalPoints,
      startersCount: computed.startersCount,
      breakdown,
      provisional: matchWeek.status !== "FINALIZED",
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/scoring error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
