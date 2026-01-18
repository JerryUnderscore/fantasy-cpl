import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { persistTeamMatchWeekScore } from "@/lib/scoring-persist";
import { finalizeLeagueMatchupsForMatchWeek, recomputeLeagueTeamRecords } from "@/lib/h2h";
import { ScoreStatus, StandingsMode } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();

    const body = await request.json().catch(() => null);
    const matchWeekId =
      typeof body?.matchWeekId === "string" ? body.matchWeekId : null;

    if (!matchWeekId) {
      return NextResponse.json(
        { error: "matchWeekId is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.matchWeek.findUnique({
      where: { id: matchWeekId },
      select: { id: true, finalizedAt: true, seasonId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
    }

    if (existing.status === "FINALIZED") {
      return NextResponse.json(
        { error: "MatchWeek already finalized" },
        { status: 409 },
      );
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { league: { seasonId: existing.seasonId } },
      select: { id: true },
    });

    const errors: Array<{ teamId: string; error: string }> = [];

    for (const team of teams) {
      try {
        await persistTeamMatchWeekScore(team.id, matchWeekId, {
          status: ScoreStatus.FINAL,
        });
      } catch (error) {
        errors.push({
          teamId: team.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (errors.length) {
      return NextResponse.json(
        { error: "Failed to compute all team scores", errors },
        { status: 500 },
      );
    }

    const h2hLeagues = await prisma.league.findMany({
      where: { seasonId: existing.seasonId, standingsMode: StandingsMode.HEAD_TO_HEAD },
      select: { id: true },
    });

    const h2hErrors: Array<{ leagueId: string; error: string }> = [];

    for (const league of h2hLeagues) {
      try {
        await finalizeLeagueMatchupsForMatchWeek(league.id, matchWeekId);
        await recomputeLeagueTeamRecords(league.id);
      } catch (error) {
        h2hErrors.push({
          leagueId: league.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (h2hErrors.length) {
      return NextResponse.json(
        { error: "Failed to update H2H matchups", errors: h2hErrors },
        { status: 500 },
      );
    }

    const matchWeek = await prisma.matchWeek.update({
      where: { id: matchWeekId },
      data: {
        status: "FINALIZED",
        finalizedAt: existing.finalizedAt ?? new Date(),
      },
      select: {
        id: true,
        number: true,
        status: true,
        lockAt: true,
        finalizedAt: true,
        seasonId: true,
      },
    });

    return NextResponse.json({
      matchWeek,
      teamsProcessed: teams.length,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/matchweeks/finalize error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
