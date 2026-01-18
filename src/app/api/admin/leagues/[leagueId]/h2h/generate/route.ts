import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { generateRoundRobinSchedule } from "@/lib/h2h";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type Mode = "ROUND_ROBIN" | "SWISS";

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdminUser();

    const { leagueId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const mode = (body?.mode as Mode) ?? "ROUND_ROBIN";
    const force = body?.force === true;

    if (mode !== "ROUND_ROBIN") {
      return NextResponse.json(
        { error: "Only ROUND_ROBIN is supported right now" },
        { status: 400 },
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true, standingsMode: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const existingMatchups = await prisma.leagueMatchup.count({
      where: { leagueId },
    });

    if (existingMatchups > 0 && !force) {
      return NextResponse.json(
        { error: "Matchups already generated. Pass force=true to regenerate." },
        { status: 409 },
      );
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (teams.length < 2) {
      return NextResponse.json(
        { error: "Need at least two teams to generate matchups" },
        { status: 400 },
      );
    }

    const schedule = generateRoundRobinSchedule(teams.map((team) => team.id));
    if (schedule.length === 0) {
      return NextResponse.json(
        { error: "Unable to generate matchups" },
        { status: 400 },
      );
    }

    const existingMatchWeeks = await prisma.matchWeek.findMany({
      where: { seasonId: league.seasonId },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    });

    const requiredMatchWeeks = schedule.length;
    const matchWeekIds = existingMatchWeeks.map((week) => week.id);
    let createdCount = 0;

    if (matchWeekIds.length < requiredMatchWeeks) {
      const lastNumber = existingMatchWeeks.at(-1)?.number ?? 0;
      const toCreate = Array.from(
        { length: requiredMatchWeeks - matchWeekIds.length },
        (_, index) => lastNumber + index + 1,
      );

      const createdMatchWeeks = await prisma.$transaction(
        toCreate.map((number) =>
          prisma.matchWeek.create({
            data: {
              seasonId: league.seasonId,
              number,
              name: `MatchWeek ${number}`,
              status: "OPEN",
              lockAt: null,
              finalizedAt: null,
            },
            select: { id: true },
          }),
        ),
      );

      createdCount = createdMatchWeeks.length;
      matchWeekIds.push(...createdMatchWeeks.map((week) => week.id));
    }

    const matchupsToCreate = schedule.flatMap((round, index) => {
      const matchWeekId = matchWeekIds[index];
      return round.map((matchup) => ({
        leagueId,
        matchWeekId,
        homeTeamId: matchup.homeTeamId,
        awayTeamId: matchup.awayTeamId,
      }));
    });

    const result = await prisma.$transaction(async (tx) => {
      if (force) {
        await tx.leagueMatchup.deleteMany({ where: { leagueId } });
        await tx.leagueTeamRecord.deleteMany({ where: { leagueId } });
      }

      if (matchupsToCreate.length) {
        await tx.leagueMatchup.createMany({ data: matchupsToCreate });
      }

      return matchupsToCreate.length;
    });

    return NextResponse.json({
      ok: true,
      leagueId,
      standingsMode: league.standingsMode,
      teams: teams.length,
      matchupsCreated: result,
      matchWeeksCreated: createdCount,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/leagues/[leagueId]/h2h/generate error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
