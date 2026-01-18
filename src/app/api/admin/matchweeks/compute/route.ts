import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { persistTeamMatchWeekScore } from "@/lib/scoring-persist";
import { ScoreStatus } from "@prisma/client";

export const runtime = "nodejs";

type TeamError = { teamId: string; error: string };

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();

    const body = await request.json().catch(() => null);
    const matchWeekId =
      typeof body?.matchWeekId === "string" ? body.matchWeekId : null;
    const leagueId = typeof body?.leagueId === "string" ? body.leagueId : null;
    const force = body?.force === true;

    if (!matchWeekId) {
      return NextResponse.json(
        { error: "matchWeekId is required" },
        { status: 400 },
      );
    }

    const matchWeek = await prisma.matchWeek.findUnique({
      where: { id: matchWeekId },
      select: { id: true, seasonId: true, status: true },
    });

    if (!matchWeek) {
      return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
    }

    if (matchWeek.status === "FINALIZED" && !force) {
      return NextResponse.json(
        { error: "MatchWeek already finalized" },
        { status: 409 },
      );
    }

    if (leagueId) {
      const league = await prisma.league.findUnique({
        where: { id: leagueId },
        select: { id: true, seasonId: true },
      });

      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }

      if (league.seasonId !== matchWeek.seasonId) {
        return NextResponse.json(
          { error: "League does not match MatchWeek season" },
          { status: 400 },
        );
      }
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: leagueId
        ? { leagueId }
        : { league: { seasonId: matchWeek.seasonId } },
      select: { id: true },
    });

    const scoreStatus =
      matchWeek.status === "FINALIZED"
        ? ScoreStatus.FINAL
        : ScoreStatus.PROVISIONAL;

    let teamScoresCreated = 0;
    let teamScoresUpdated = 0;
    const errors: TeamError[] = [];

    for (const team of teams) {
      try {
        const result = await persistTeamMatchWeekScore(team.id, matchWeekId, {
          status: scoreStatus,
        });

        if (result.created) {
          teamScoresCreated += 1;
        } else {
          teamScoresUpdated += 1;
        }
      } catch (error) {
        errors.push({
          teamId: team.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      teamsProcessed: teams.length,
      teamScoresCreated,
      teamScoresUpdated,
      errors,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/matchweeks/compute error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
