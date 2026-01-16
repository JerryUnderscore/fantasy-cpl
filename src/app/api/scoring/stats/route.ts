import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type IncomingStat = {
  playerId?: string;
  minutes?: number;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  ownGoals?: number;
  cleanSheet?: boolean;
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const toInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
};

export async function POST(request: NextRequest) {
  try {
    if (process.env.ALLOW_DEV_STAT_WRITES !== "true") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const matchWeekNumber = Number(body?.matchWeekNumber);
    const stats = Array.isArray(body?.stats) ? (body.stats as IncomingStat[]) : [];

    if (!Number.isInteger(matchWeekNumber) || matchWeekNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid matchWeekNumber" },
        { status: 400 },
      );
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      orderBy: { year: "desc" },
      select: { id: true },
    });

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const matchWeek = await prisma.matchWeek.upsert({
      where: {
        seasonId_number: {
          seasonId: season.id,
          number: matchWeekNumber,
        },
      },
      create: {
        seasonId: season.id,
        number: matchWeekNumber,
        name: `MatchWeek ${matchWeekNumber}`,
        isLocked: false,
      },
      update: {},
      select: { id: true },
    });

    const normalizedStats = stats
      .map((stat) => {
        const playerId = stat.playerId?.trim();
        if (!playerId) return null;

        return {
          playerId,
          matchWeekId: matchWeek.id,
          minutes: Math.max(0, toInt(stat.minutes)),
          goals: Math.max(0, toInt(stat.goals)),
          assists: Math.max(0, toInt(stat.assists)),
          yellowCards: Math.max(0, toInt(stat.yellowCards)),
          redCards: Math.max(0, toInt(stat.redCards)),
          ownGoals: Math.max(0, toInt(stat.ownGoals)),
          cleanSheet: Boolean(stat.cleanSheet),
        };
      })
      .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));

    if (!normalizedStats.length) {
      return NextResponse.json(
        { error: "No stats provided" },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      normalizedStats.map((stat) =>
        prisma.playerMatchStat.upsert({
          where: {
            playerId_matchWeekId: {
              playerId: stat.playerId,
              matchWeekId: stat.matchWeekId,
            },
          },
          create: stat,
          update: stat,
        }),
      ),
    );

    return NextResponse.json({ ok: true, upserted: normalizedStats.length });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/scoring/stats error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
