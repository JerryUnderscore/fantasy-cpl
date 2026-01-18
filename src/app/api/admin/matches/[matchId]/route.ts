import { NextRequest, NextResponse } from "next/server";
import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { recalculateMatchWeekLockAt } from "@/lib/matchweek";
import { parseEasternDateTime } from "@/lib/time";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ matchId: string }> };

const allowedStatuses = new Set<MatchStatus>([
  MatchStatus.SCHEDULED,
  MatchStatus.POSTPONED,
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
]);

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdminUser();

    const { matchId } = await ctx.params;
    const body = await request.json().catch(() => null);

    const kickoffAtEastern =
      typeof body?.kickoffAtEastern === "string" ? body.kickoffAtEastern : null;
    const matchWeekNumber = Number(body?.matchWeekNumber);
    const status =
      typeof body?.status === "string"
        ? (body.status.toUpperCase() as MatchStatus)
        : null;

    if (!kickoffAtEastern) {
      return NextResponse.json(
        { error: "kickoffAtEastern is required" },
        { status: 400 },
      );
    }

    const kickoffAt = parseEasternDateTime(kickoffAtEastern);
    if (!kickoffAt) {
      return NextResponse.json(
        { error: "kickoffAtEastern must be YYYY-MM-DD HH:mm (ET)." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(matchWeekNumber) || matchWeekNumber <= 0) {
      return NextResponse.json(
        { error: "matchWeekNumber must be a positive integer." },
        { status: 400 },
      );
    }

    if (!status || !allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "status must be SCHEDULED, POSTPONED, COMPLETED, or CANCELED." },
        { status: 400 },
      );
    }

    const existingMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, seasonId: true, matchWeekId: true },
    });

    if (!existingMatch) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    let matchWeek = await prisma.matchWeek.findUnique({
      where: {
        seasonId_number: {
          seasonId: existingMatch.seasonId,
          number: matchWeekNumber,
        },
      },
      select: { id: true },
    });

    if (!matchWeek) {
      matchWeek = await prisma.matchWeek.create({
        data: {
          seasonId: existingMatch.seasonId,
          number: matchWeekNumber,
          name: `MatchWeek ${matchWeekNumber}`,
          status: "OPEN",
        },
        select: { id: true },
      });
    }

    const match = await prisma.match.update({
      where: { id: existingMatch.id },
      data: {
        kickoffAt,
        matchWeekId: matchWeek.id,
        status,
      },
      select: {
        id: true,
        kickoffAt: true,
        status: true,
        matchWeekId: true,
      },
    });

    const touchedMatchWeeks = [existingMatch.matchWeekId, match.matchWeekId]
      .filter((value): value is string => Boolean(value));

    const { updatedCount: lockAtUpdatedCount } =
      await recalculateMatchWeekLockAt(touchedMatchWeeks);

    return NextResponse.json({ match, lockAtUpdatedCount });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/admin/matches/[matchId] error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
