import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { recalculateMatchWeekLockAt } from "@/lib/matchweek";
import { parseEasternDateTime } from "@/lib/time";

export const runtime = "nodejs";

const parseDateFilter = (value: string | null, endOfDay: boolean) => {
  if (!value) return null;
  const suffix = endOfDay ? "23:59" : "00:00";
  return parseEasternDateTime(`${value} ${suffix}`);
};

const buildMatchWhere = (searchParams: URLSearchParams) => {
  const seasonId = searchParams.get("seasonId");
  const matchWeekNumber = Number(searchParams.get("matchWeekNumber"));
  const clubSlug = searchParams.get("clubSlug");
  const dateFrom = parseDateFilter(searchParams.get("dateFrom"), false);
  const dateTo = parseDateFilter(searchParams.get("dateTo"), true);

  if (!seasonId) {
    return { error: "seasonId is required" as const };
  }

  const where: Record<string, unknown> = { seasonId };

  if (Number.isInteger(matchWeekNumber) && matchWeekNumber > 0) {
    where.matchWeek = { number: matchWeekNumber };
  }

  if (clubSlug) {
    where.OR = [
      { homeClub: { slug: clubSlug } },
      { awayClub: { slug: clubSlug } },
    ];
  }

  if (dateFrom || dateTo) {
    where.kickoffAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  return { where };
};

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const { where, error } = buildMatchWhere(searchParams);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true,
        externalId: true,
        kickoffAt: true,
        status: true,
        matchWeek: { select: { number: true } },
        homeClub: { select: { slug: true, shortName: true, name: true } },
        awayClub: { select: { slug: true, shortName: true, name: true } },
      },
    });

    return NextResponse.json({
      matches: matches.map((match) => ({
        id: match.id,
        externalId: match.externalId,
        kickoffAt: match.kickoffAt,
        status: match.status,
        matchWeekNumber: match.matchWeek?.number ?? null,
        homeClub: match.homeClub,
        awayClub: match.awayClub,
      })),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/matches error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const { where, error } = buildMatchWhere(searchParams);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: "confirm=true is required to delete matches" },
        { status: 400 },
      );
    }

    const matches = await prisma.match.findMany({
      where,
      select: { id: true, matchWeekId: true },
    });

    const deleted = await prisma.match.deleteMany({ where });

    const matchWeekIds = matches
      .map((match) => match.matchWeekId)
      .filter((matchWeekId): matchWeekId is string => Boolean(matchWeekId));

    if (matchWeekIds.length > 0) {
      await recalculateMatchWeekLockAt(matchWeekIds);
    }

    return NextResponse.json({ deletedCount: deleted.count });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("DELETE /api/admin/matches error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
