import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { computeLeagueTeamRecords } from "@/lib/h2h";
import { H2HResultStatus, StandingsMode } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
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
      select: { id: true, seasonId: true, standingsMode: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: {
        id: true,
        name: true,
        profile: { select: { displayName: true } },
      },
    });

    const teamIds = teams.map((team) => team.id);

    if (league.standingsMode === StandingsMode.HEAD_TO_HEAD) {
      const matchupCount = await prisma.leagueMatchup.count({
        where: { leagueId },
      });

      if (matchupCount === 0) {
        return NextResponse.json(
          { error: "No matchups found. Generate H2H schedule first." },
          { status: 409 },
        );
      }

      const existingRecords = await prisma.leagueTeamRecord.findMany({
        where: { leagueId },
        select: {
          fantasyTeamId: true,
          wins: true,
          draws: true,
          losses: true,
          points: true,
          pointsFor: true,
          pointsAgainst: true,
          playedFinalized: true,
        },
      });

      const recordMap = new Map(
        existingRecords.map((record) => [record.fantasyTeamId, record]),
      );

      let computedRecords = recordMap;

      if (existingRecords.length === 0) {
        const finalizedMatchups = await prisma.leagueMatchup.findMany({
          where: { leagueId, resultStatus: H2HResultStatus.FINAL },
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homePoints: true,
            awayPoints: true,
          },
        });

        const computed = computeLeagueTeamRecords(teamIds, finalizedMatchups);
        computedRecords = new Map(
          computed.map((record) => [record.fantasyTeamId, record]),
        );
      }

      const rows = teams
        .map((team) => {
          const record = computedRecords.get(team.id);
          return {
            fantasyTeamId: team.id,
            teamName: team.name,
            ownerName: team.profile.displayName ?? null,
            wins: record?.wins ?? 0,
            draws: record?.draws ?? 0,
            losses: record?.losses ?? 0,
            points: record?.points ?? 0,
            pointsFor: record?.pointsFor ?? 0,
            pointsAgainst: record?.pointsAgainst ?? 0,
            playedFinalized: record?.playedFinalized ?? 0,
          };
        })
        .sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points;
          }
          const goalDiffA = a.pointsFor - a.pointsAgainst;
          const goalDiffB = b.pointsFor - b.pointsAgainst;
          if (goalDiffB !== goalDiffA) {
            return goalDiffB - goalDiffA;
          }
          if (b.pointsFor !== a.pointsFor) {
            return b.pointsFor - a.pointsFor;
          }
          return a.teamName.localeCompare(b.teamName);
        });

      const rankedRows = rows.map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

      return NextResponse.json({
        leagueId,
        seasonId: league.seasonId,
        standingsMode: league.standingsMode,
        rows: rankedRows,
      });
    }

    const aggregates = teamIds.length
      ? await prisma.teamMatchWeekScore.groupBy({
          by: ["fantasyTeamId"],
          where: {
            fantasyTeamId: { in: teamIds },
            status: "FINAL",
          },
          _sum: { points: true },
          _count: { _all: true },
        })
      : [];

    const aggregateMap = new Map(
      aggregates.map((row) => [row.fantasyTeamId, row]),
    );

    const rows = teams
      .map((team) => {
        const summary = aggregateMap.get(team.id);
        const totalPoints = summary?._sum.points ?? 0;
        const playedFinalized = summary?._count._all ?? 0;

        return {
          fantasyTeamId: team.id,
          teamName: team.name,
          ownerName: team.profile.displayName ?? null,
          totalPoints,
          playedFinalized,
        };
      })
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        if (b.playedFinalized !== a.playedFinalized) {
          return b.playedFinalized - a.playedFinalized;
        }
        return a.teamName.localeCompare(b.teamName);
      });

    const rankedRows = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

    return NextResponse.json({
      leagueId,
      seasonId: league.seasonId,
      standingsMode: league.standingsMode,
      rows: rankedRows,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/standings error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
