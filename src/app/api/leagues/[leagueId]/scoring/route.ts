import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { PlayerMatchStat } from "@prisma/client";
import { scorePlayer } from "@/lib/scoring";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const buildEmptyStat = (
  playerId: string,
  matchWeekId: string,
): PlayerMatchStat => ({
  id: `missing-${playerId}-${matchWeekId}`,
  playerId,
  matchWeekId,
  minutes: 0,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  cleanSheet: false,
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
      select: { id: true, number: true },
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

    const starters = await prisma.rosterSlot.findMany({
      where: {
        fantasyTeamId: team.id,
        isStarter: true,
        playerId: { not: null },
      },
      select: {
        playerId: true,
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            club: { select: { slug: true } },
          },
        },
      },
    });

    const playerIds = starters
      .map((slot) => slot.playerId)
      .filter((id): id is string => Boolean(id));

    const stats = await prisma.playerMatchStat.findMany({
      where: {
        matchWeekId: matchWeek.id,
        playerId: { in: playerIds },
      },
    });

    const statsByPlayer = new Map(stats.map((stat) => [stat.playerId, stat]));

    const breakdown = starters.map((slot) => {
      if (!slot.player || !slot.playerId) {
        return null;
      }

      const stat =
        statsByPlayer.get(slot.playerId) ??
        buildEmptyStat(slot.playerId, matchWeek.id);
      const scored = scorePlayer(slot.player.position, stat);

      return {
        playerId: slot.player.id,
        playerName: slot.player.name,
        position: slot.player.position,
        clubSlug: slot.player.club?.slug ?? null,
        minutes: stat.minutes,
        points: scored.points,
        components: scored.components,
      };
    });

    const filteredBreakdown = breakdown.filter(
      (entry): entry is NonNullable<typeof entry> => Boolean(entry),
    );

    const totalPoints = filteredBreakdown.reduce(
      (sum, entry) => sum + entry.points,
      0,
    );

    return NextResponse.json({
      ok: true,
      leagueId,
      matchWeek,
      team,
      totalPoints,
      startersCount: filteredBreakdown.length,
      breakdown: filteredBreakdown,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/scoring error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
