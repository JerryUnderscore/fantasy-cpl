import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { buildRosterSlots, computeCurrentPick } from "@/lib/draft";

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
        const txDraft = await tx.draft.findUnique({
          where: { id: draft.id },
          select: {
            id: true,
            status: true,
            rounds: true,
            currentPickStartedAt: true,
          },
        });

        if (!txDraft || txDraft.status !== "LIVE") {
          return { updated: false };
        }

        const txPicks = await tx.draftPick.findMany({
          where: { draftId: txDraft.id },
          select: { pickNumber: true, fantasyTeamId: true },
          orderBy: { pickNumber: "asc" },
        });

        const currentPick = computeCurrentPick(teams, txPicks, txDraft.rounds);
        const totalPicks = txDraft.rounds * teams.length;

        if (!currentPick) {
          if (txPicks.length >= totalPicks) {
            await tx.draft.update({
              where: { id: txDraft.id },
              data: { status: "COMPLETE", currentPickStartedAt: null },
            });
            return { updated: true };
          }
          return { updated: false };
        }

        const queuedItem = await tx.draftQueueItem.findFirst({
          where: {
            draftId: txDraft.id,
            fantasyTeamId: currentPick.fantasyTeamId,
            player: {
              seasonId: league.season.id,
              active: true,
              draftPicks: { none: { draftId: txDraft.id } },
            },
          },
          orderBy: { rank: "asc" },
          select: { playerId: true },
        });

        const queuedPlayerId = queuedItem?.playerId ?? null;

        const fallbackPlayer = queuedPlayerId
          ? null
          : await tx.player.findFirst({
              where: {
                seasonId: league.season.id,
                active: true,
                draftPicks: { none: { draftId: txDraft.id } },
              },
              orderBy: { name: "asc" },
              select: { id: true },
            });

        const playerId = queuedPlayerId ?? fallbackPlayer?.id ?? null;

        if (!playerId) {
          return { updated: false };
        }

        await tx.rosterSlot.createMany({
          data: buildRosterSlots(
            currentPick.fantasyTeamId,
            leagueId,
            league.rosterSize,
          ),
          skipDuplicates: true,
        });

        const openSlot = await tx.rosterSlot.findFirst({
          where: {
            fantasyTeamId: currentPick.fantasyTeamId,
            playerId: null,
          },
          orderBy: { slotNumber: "asc" },
          select: { id: true },
        });

        if (!openSlot) {
          return { updated: false };
        }

        const pickingTeam = teams.find(
          (team) => team.id === currentPick.fantasyTeamId,
        );

        if (!pickingTeam) {
          return { updated: false };
        }

        await tx.draftPick.create({
          data: {
            draftId: txDraft.id,
            pickNumber: currentPick.pickNumber,
            round: currentPick.round,
            slotInRound: currentPick.slotInRound,
            fantasyTeamId: currentPick.fantasyTeamId,
            profileId: pickingTeam.profileId,
            playerId,
          },
        });

        await tx.rosterSlot.update({
          where: { id: openSlot.id },
          data: { playerId },
        });

        await tx.draftQueueItem.deleteMany({
          where: {
            draftId: txDraft.id,
            fantasyTeamId: currentPick.fantasyTeamId,
            playerId,
          },
        });

        const nextStatus =
          currentPick.pickNumber >= totalPicks ? "COMPLETE" : "LIVE";
        const committedAt = new Date();
        const safeCommittedAt =
          txDraft.currentPickStartedAt &&
          txDraft.currentPickStartedAt.getTime() > committedAt.getTime()
            ? txDraft.currentPickStartedAt
            : committedAt;

        await tx.draft.update({
          where: { id: txDraft.id },
          data: {
            status: nextStatus,
            currentPickStartedAt: nextStatus === "COMPLETE" ? null : safeCommittedAt,
          },
        });

        return { updated: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ ok: true, updated: result.updated });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Pick already exists" }, { status: 409 });
    }
    console.error("POST /api/leagues/[leagueId]/draft/advance error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
