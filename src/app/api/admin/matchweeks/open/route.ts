import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { getActiveSeason } from "@/lib/matchweek";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();

    const body = await request.json().catch(() => null);
    const number = Number(body?.number);

    if (!Number.isInteger(number) || number <= 0) {
      return NextResponse.json({ error: "Invalid MatchWeek number" }, { status: 400 });
    }

    const season = await getActiveSeason();

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    const matchWeek = await prisma.$transaction(async (tx) => {
      const upserted = await tx.matchWeek.upsert({
        where: {
          seasonId_number: {
            seasonId: season.id,
            number,
          },
        },
        create: {
          seasonId: season.id,
          number,
          name: `MatchWeek ${number}`,
          status: "OPEN",
          lockAt: null,
          finalizedAt: null,
        },
        update: {
          status: "OPEN",
          lockAt: null,
          finalizedAt: null,
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

      await tx.matchWeek.updateMany({
        where: {
          seasonId: season.id,
          id: { not: upserted.id },
          status: "OPEN",
        },
        data: { status: "LOCKED" },
      });

      return upserted;
    });

    return NextResponse.json({ matchWeek });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/matchweeks/open error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
