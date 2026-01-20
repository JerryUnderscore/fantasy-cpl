import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: { select: { id: true, isActive: true } },
        draftMode: true,
        draftPickSeconds: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    if (league.draftMode === "NONE") {
      return NextResponse.json(
        { error: "Drafts are disabled for this league" },
        { status: 409 },
      );
    }

    if (
      league.draftMode === "LIVE" &&
      (typeof league.draftPickSeconds !== "number" ||
        !Number.isInteger(league.draftPickSeconds))
    ) {
      return NextResponse.json(
        { error: "Draft pick seconds required for live drafts" },
        { status: 400 },
      );
    }

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: {
        id: true,
        status: true,
        isPaused: true,
        pausedRemainingSeconds: true,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not started" }, { status: 400 });
    }

    if (draft.status !== "LIVE") {
      return NextResponse.json({ error: "Draft is not live" }, { status: 409 });
    }

    if (!draft.isPaused) {
      return NextResponse.json({ error: "Draft is not paused" }, { status: 409 });
    }

    const now = new Date();
    const pickSeconds = league.draftPickSeconds ?? 0;
    const pausedSeconds =
      typeof draft.pausedRemainingSeconds === "number"
        ? Math.max(0, draft.pausedRemainingSeconds)
        : pickSeconds;
    const elapsedSeconds = Math.max(0, pickSeconds - pausedSeconds);
    const currentPickStartedAt = new Date(
      now.getTime() - elapsedSeconds * 1000,
    );

    const updated = await prisma.draft.update({
      where: { id: draft.id },
      data: {
        isPaused: false,
        pausedRemainingSeconds: null,
        currentPickStartedAt:
          league.draftMode === "LIVE" ? currentPickStartedAt : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ draftId: updated.id });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/draft/resume error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
