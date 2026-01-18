import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

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
    let matchWeekNumber: number | null = null;

    if (matchWeekParam) {
      const parsed = Number(matchWeekParam);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: "Invalid matchWeek" },
          { status: 400 },
        );
      }
      matchWeekNumber = parsed;
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

    let matchWeekId: string | null = null;
    if (matchWeekNumber) {
      const matchWeek = await prisma.matchWeek.findUnique({
        where: {
          seasonId_number: {
            seasonId: league.seasonId,
            number: matchWeekNumber,
          },
        },
        select: { id: true },
      });

      if (!matchWeek) {
        return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
      }
      matchWeekId = matchWeek.id;
    }

    const matchups = await prisma.leagueMatchup.findMany({
      where: {
        leagueId,
        ...(matchWeekId ? { matchWeekId } : {}),
      },
      orderBy: [{ matchWeekId: "asc" }, { id: "asc" }],
      select: {
        id: true,
        matchWeek: { select: { number: true } },
        homeTeamId: true,
        awayTeamId: true,
        homePoints: true,
        awayPoints: true,
        resultStatus: true,
        winnerTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    });

    return NextResponse.json({
      leagueId,
      matchWeekNumber: matchWeekNumber ?? null,
      matchups: matchups.map((matchup) => ({
        id: matchup.id,
        matchWeekNumber: matchup.matchWeek.number,
        homeTeamId: matchup.homeTeamId,
        homeTeamName: matchup.homeTeam.name,
        awayTeamId: matchup.awayTeamId,
        awayTeamName: matchup.awayTeam.name,
        homePoints: matchup.homePoints,
        awayPoints: matchup.awayPoints,
        resultStatus: matchup.resultStatus,
        winnerTeamId: matchup.winnerTeamId,
      })),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/matchups error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
