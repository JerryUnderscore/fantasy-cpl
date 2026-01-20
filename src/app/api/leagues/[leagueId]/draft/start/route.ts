import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: { select: { id: true, isActive: true } },
        draftMode: true,
        draftPickSeconds: true,
        draftScheduledAt: true,
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

    if (league.draftMode === "LIVE") {
      if (
        typeof league.draftPickSeconds !== "number" ||
        !Number.isInteger(league.draftPickSeconds)
      ) {
        return NextResponse.json(
          { error: "Draft pick seconds required for live drafts" },
          { status: 400 },
        );
      }
      if (!league.draftScheduledAt) {
        return NextResponse.json(
          { error: "Draft schedule required for live drafts" },
          { status: 400 },
        );
      }
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

    const existing = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: { id: true, status: true, isPaused: true },
    });

    const now = new Date();

    if (existing) {
      if (existing.status === "LIVE") {
        if (existing.isPaused) {
          return NextResponse.json(
            { error: "Draft is paused. Resume instead." },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "Draft already live" },
          { status: 409 },
        );
      }
      if (existing.status === "COMPLETE") {
        return NextResponse.json(
          { error: "Draft already complete" },
          { status: 409 },
        );
      }

      const updated = await prisma.draft.update({
        where: { id: existing.id },
        data: {
          status: "LIVE",
          currentPickStartedAt: league.draftMode === "LIVE" ? now : null,
          isPaused: false,
          pausedRemainingSeconds: null,
        },
        select: { id: true },
      });

      return NextResponse.json({ draftId: updated.id });
    }

    const draft = await prisma.draft.create({
      data: {
        leagueId,
        seasonId: league.season.id,
        status: "LIVE",
        rounds: 15,
        currentPickStartedAt: league.draftMode === "LIVE" ? now : null,
        isPaused: false,
        pausedRemainingSeconds: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ draftId: draft.id });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/draft/start error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
