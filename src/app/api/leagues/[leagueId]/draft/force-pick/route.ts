import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { buildRosterSlots, computeCurrentPick } from "@/lib/draft";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type DraftError = Error & { status?: number };

const makeError = (message: string, status: number) => {
  const error = new Error(message) as DraftError;
  error.status = status;
  return error;
};

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

export async function POST(request: NextRequest, ctx: Ctx) {
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

    const body = await request.json().catch(() => null);
    const playerId = typeof body?.playerId === "string" ? body.playerId : null;

    if (!playerId) {
      return NextResponse.json({ error: "Player is required" }, { status: 400 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: { select: { id: true, isActive: true } },
        draftMode: true,
        rosterSize: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    if (league.draftMode !== "MANUAL") {
      return NextResponse.json(
        { error: "Manual draft mode required" },
        { status: 409 },
      );
    }

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: { id: true, status: true, rounds: true },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not started" }, { status: 400 });
    }

    if (draft.status !== "LIVE") {
      return NextResponse.json({ error: "Draft is not live" }, { status: 409 });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true, profileId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (!teams.length) {
      return NextResponse.json({ error: "No teams in league" }, { status: 400 });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const freshDraft = await tx.draft.findUnique({
          where: { id: draft.id },
          select: {
            id: true,
            status: true,
            rounds: true,
            currentPickStartedAt: true,
          },
        });

        if (!freshDraft) {
          throw makeError("Draft not started", 400);
        }

        if (freshDraft.status !== "LIVE") {
          throw makeError("Draft is not live", 409);
        }

        const picks = await tx.draftPick.findMany({
          where: { draftId: freshDraft.id },
          select: { pickNumber: true, fantasyTeamId: true },
          orderBy: { pickNumber: "asc" },
        });

        const currentPick = computeCurrentPick(teams, picks, freshDraft.rounds);
        const totalPicks = freshDraft.rounds * teams.length;

        if (!currentPick) {
          throw makeError("Draft is complete", 409);
        }

        const onTheClockTeam = teams.find(
          (team) => team.id === currentPick.fantasyTeamId,
        );

        if (!onTheClockTeam) {
          throw makeError("Draft order error", 409);
        }

        const player = await tx.player.findUnique({
          where: { id: playerId },
          select: { id: true, seasonId: true, active: true },
        });

        if (!player || !player.active || player.seasonId !== league.season.id) {
          throw makeError("Player not available", 400);
        }

        const existingPick = await tx.draftPick.findUnique({
          where: { draftId_playerId: { draftId: freshDraft.id, playerId } },
          select: { id: true },
        });

        if (existingPick) {
          throw makeError("Player already drafted", 409);
        }

        await tx.rosterSlot.createMany({
          data: buildRosterSlots(onTheClockTeam.id, leagueId, league.rosterSize),
          skipDuplicates: true,
        });

        const openSlot = await tx.rosterSlot.findFirst({
          where: { fantasyTeamId: onTheClockTeam.id, playerId: null },
          orderBy: { slotNumber: "asc" },
          select: { id: true },
        });

        if (!openSlot) {
          throw makeError("Roster is full", 409);
        }

        const pick = await tx.draftPick.create({
          data: {
            draftId: freshDraft.id,
            pickNumber: currentPick.pickNumber,
            round: currentPick.round,
            slotInRound: currentPick.slotInRound,
            fantasyTeamId: onTheClockTeam.id,
            profileId: onTheClockTeam.profileId,
            playerId,
          },
          select: {
            id: true,
            pickNumber: true,
            round: true,
            slotInRound: true,
            fantasyTeamId: true,
            playerId: true,
          },
        });

        await tx.rosterSlot.update({
          where: { id: openSlot.id },
          data: { playerId },
        });

        await tx.draftQueueItem.deleteMany({
          where: {
            draftId: freshDraft.id,
            fantasyTeamId: onTheClockTeam.id,
            playerId,
          },
        });

        const nextStatus =
          currentPick.pickNumber >= totalPicks ? "COMPLETE" : "LIVE";

        const committedAt = new Date();
        const safeCommittedAt =
          freshDraft.currentPickStartedAt &&
          freshDraft.currentPickStartedAt.getTime() > committedAt.getTime()
            ? freshDraft.currentPickStartedAt
            : committedAt;

        await tx.draft.update({
          where: { id: freshDraft.id },
          data: {
            status: nextStatus,
            currentPickStartedAt: nextStatus === "COMPLETE" ? null : safeCommittedAt,
          },
        });

        return { pick, draftStatus: nextStatus };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      ok: true,
      pick: result.pick,
      draftStatus: result.draftStatus,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as DraftError).status) {
      return NextResponse.json(
        { error: (error as DraftError).message },
        { status: (error as DraftError).status },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Player already drafted" }, { status: 409 });
    }
    console.error("POST /api/leagues/[leagueId]/draft/force-pick error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
