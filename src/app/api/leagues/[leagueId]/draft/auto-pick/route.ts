import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { PlayerPosition } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

const buildRosterSlots = (fantasyTeamId: string, leagueId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

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
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        draftMode: true,
        draftPickSeconds: true,
        season: { select: { id: true, isActive: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (!league.season.isActive) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    if (league.draftMode !== "TIMED") {
      return NextResponse.json(
        { error: "Auto-draft only applies to timed drafts" },
        { status: 409 },
      );
    }

    if (
      typeof league.draftPickSeconds !== "number" ||
      !Number.isInteger(league.draftPickSeconds)
    ) {
      return NextResponse.json(
        { error: "Draft pick seconds not configured" },
        { status: 400 },
      );
    }

    const draft = await prisma.draft.findUnique({
      where: {
        leagueId_seasonId: { leagueId, seasonId: league.season.id },
      },
      select: { id: true, status: true, rounds: true, createdAt: true },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not started" }, { status: 400 });
    }

    if (draft.status !== "LIVE") {
      return NextResponse.json({ error: "Draft is not live" }, { status: 409 });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, profileId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (teams.length === 0) {
      return NextResponse.json({ error: "No teams in league" }, { status: 400 });
    }

    const picksCount = await prisma.draftPick.count({
      where: { draftId: draft.id },
    });

    const teamCount = teams.length;
    const totalPicks = draft.rounds * teamCount;
    const pickNumber = picksCount + 1;

    if (pickNumber > totalPicks) {
      return NextResponse.json({ error: "Draft is complete" }, { status: 409 });
    }

    const round = Math.ceil(pickNumber / teamCount);
    const slotInRound = ((pickNumber - 1) % teamCount) + 1;
    const teamIndex =
      round % 2 === 1 ? slotInRound - 1 : teamCount - slotInRound;
    const onTheClockTeam = teams[teamIndex];

    if (!onTheClockTeam) {
      return NextResponse.json({ error: "Draft order error" }, { status: 409 });
    }

    const lastPick = await prisma.draftPick.findFirst({
      where: { draftId: draft.id },
      orderBy: { pickNumber: "desc" },
      select: { createdAt: true },
    });

    const pickStartAt = lastPick?.createdAt ?? draft.createdAt;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - pickStartAt.getTime()) / 1000);

    if (elapsedSeconds < league.draftPickSeconds) {
      return NextResponse.json(
        { error: "Pick timer has not expired" },
        { status: 409 },
      );
    }

    const hasGoalkeeper = await prisma.rosterSlot.findFirst({
      where: {
        leagueId,
        fantasyTeamId: onTheClockTeam.id,
        player: { position: "GK" },
      },
      select: { id: true },
    });

    const player = await prisma.player.findFirst({
      where: {
        seasonId: league.season.id,
        draftPicks: { none: { draftId: draft.id } },
        ...(hasGoalkeeper ? { position: { not: "GK" } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true },
    });

    if (!player) {
      return NextResponse.json(
        { error: "No eligible players" },
        { status: 409 },
      );
    }

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(onTheClockTeam.id, leagueId),
      skipDuplicates: true,
    });

    const openSlot = await prisma.rosterSlot.findFirst({
      where: { fantasyTeamId: onTheClockTeam.id, playerId: null },
      orderBy: { slotNumber: "asc" },
      select: { id: true },
    });

    if (!openSlot) {
      return NextResponse.json({ error: "Roster is full" }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const pick = await tx.draftPick.create({
        data: {
          draftId: draft.id,
          pickNumber,
          round,
          slotInRound,
          fantasyTeamId: onTheClockTeam.id,
          profileId: onTheClockTeam.profileId,
          playerId: player.id,
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
        data: { playerId: player.id },
      });

      let draftStatus = draft.status;
      if (pickNumber === totalPicks) {
        await tx.draft.update({
          where: { id: draft.id },
          data: { status: "COMPLETE" },
        });
        draftStatus = "COMPLETE";
      }

      return { pick, draftStatus };
    });

    return NextResponse.json({
      ok: true,
      pick: result.pick,
      draftStatus: result.draftStatus,
      auto: true,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Player already drafted" },
        { status: 409 },
      );
    }
    console.error("POST /api/leagues/[leagueId]/draft/auto-pick error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
