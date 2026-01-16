import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";

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
      select: { id: true, status: true, lockAt: true },
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

    const matchWeek = await prisma.matchWeek.update({
      where: { id: matchWeekId },
      data: {
        status: "LOCKED",
        lockAt: existing.lockAt ?? new Date(),
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

    return NextResponse.json({ matchWeek });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/matchweeks/lock error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
