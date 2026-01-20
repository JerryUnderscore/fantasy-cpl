import { NextRequest, NextResponse } from "next/server";
import { MatchWeekStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { ensureLeagueWaiverPriorities } from "@/lib/waivers";
import { validateRosterAddition } from "@/lib/roster";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const MAX_PENDING_CLAIMS = 10;

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

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
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true, draftMode: true, rosterSize: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const playerId =
      typeof body?.playerId === "string" ? body.playerId : null;
    const dropPlayerId =
      typeof body?.dropPlayerId === "string" ? body.dropPlayerId : null;

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 },
      );
    }

    if (league.draftMode !== "NONE") {
      const draft = await prisma.draft.findUnique({
        where: { leagueId_seasonId: { leagueId, seasonId: league.seasonId } },
        select: { status: true },
      });

      if (!draft || draft.status !== "COMPLETE") {
        return NextResponse.json(
          { error: "Rosters are locked until the draft completes" },
          { status: 409 },
        );
      }
    }

    if (dropPlayerId && dropPlayerId === playerId) {
      return NextResponse.json(
        { error: "dropPlayerId cannot match playerId" },
        { status: 400 },
      );
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, seasonId: true, active: true, position: true },
    });

    if (!player || !player.active || player.seasonId !== league.seasonId) {
      return NextResponse.json(
        { error: "Player not available" },
        { status: 400 },
      );
    }

    const rostered = await prisma.rosterSlot.findFirst({
      where: { leagueId, playerId },
      select: { id: true },
    });

    if (rostered) {
      return NextResponse.json(
        { error: "Player already rostered in this league" },
        { status: 409 },
      );
    }

    const waiver = await prisma.leaguePlayerWaiver.findUnique({
      where: {
        leagueId_playerId: {
          leagueId,
          playerId,
        },
      },
      select: { waiverAvailableAt: true },
    });

    const now = new Date();
    if (!waiver || waiver.waiverAvailableAt <= now) {
      return NextResponse.json(
        { error: "Player is not on waivers" },
        { status: 409 },
      );
    }

    const existingClaim = await prisma.leagueWaiverClaim.findFirst({
      where: { leagueId, playerId, status: "PENDING" },
      select: { id: true },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: "Player already has a pending claim" },
        { status: 409 },
      );
    }

    const pendingCount = await prisma.leagueWaiverClaim.count({
      where: { leagueId, fantasyTeamId: team.id, status: "PENDING" },
    });

    if (pendingCount >= MAX_PENDING_CLAIMS) {
      return NextResponse.json(
        { error: "Too many pending claims" },
        { status: 409 },
      );
    }

    const slots = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: team.id },
      select: {
        id: true,
        playerId: true,
        isStarter: true,
        player: { select: { position: true } },
      },
    });

    if (!slots.length) {
      return NextResponse.json(
        { error: "Roster slots not found" },
        { status: 409 },
      );
    }

    const emptySlot = slots.find((slot) => !slot.playerId);
    const dropSlot = dropPlayerId
      ? slots.find((slot) => slot.playerId === dropPlayerId)
      : null;

    if (!emptySlot && !dropPlayerId) {
      return NextResponse.json(
        { error: "dropPlayerId is required when roster is full" },
        { status: 409 },
      );
    }

    if (dropPlayerId && !dropSlot) {
      return NextResponse.json(
        { error: "dropPlayerId is not on your roster" },
        { status: 409 },
      );
    }

    const currentPositions = slots
      .map((slot) => slot.player?.position)
      .filter((position): position is NonNullable<typeof position> =>
        Boolean(position),
      );
    const validation = validateRosterAddition({
      rosterSize: league.rosterSize,
      currentPositions,
      addPosition: player.position,
      dropPosition: dropSlot?.player?.position ?? null,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 409 });
    }

    const currentMatchWeek = await getCurrentMatchWeekForSeason(league.seasonId);
    const finalizedMatchWeek = currentMatchWeek
      ? null
      : await prisma.matchWeek.findFirst({
          where: { seasonId: league.seasonId, status: MatchWeekStatus.FINALIZED },
          orderBy: { number: "asc" },
          select: { id: true, number: true, status: true },
        });
    const lockingMatchWeek = currentMatchWeek ?? finalizedMatchWeek;
    const isLocked =
      lockingMatchWeek && lockingMatchWeek.status !== MatchWeekStatus.OPEN;

    let dropSlotIsStarter = dropSlot?.isStarter ?? false;

    if (dropSlot && lockingMatchWeek) {
      const lineupSlot = await prisma.teamMatchWeekLineupSlot.findUnique({
        where: {
          fantasyTeamId_matchWeekId_rosterSlotId: {
            fantasyTeamId: team.id,
            matchWeekId: lockingMatchWeek.id,
            rosterSlotId: dropSlot.id,
          },
        },
        select: { isStarter: true },
      });
      if (lineupSlot) {
        dropSlotIsStarter = lineupSlot.isStarter;
      }
    }

    if (dropSlotIsStarter && isLocked) {
      return NextResponse.json(
        {
          error: `Cannot drop a starter while MatchWeek ${lockingMatchWeek?.number} is locked`,
        },
        { status: 409 },
      );
    }

    const priorityMap = await ensureLeagueWaiverPriorities(prisma, leagueId);
    const priorityNumber = priorityMap.get(team.id);

    if (!priorityNumber) {
      return NextResponse.json(
        { error: "Waiver priorities not available" },
        { status: 500 },
      );
    }

    const claim = await prisma.leagueWaiverClaim.create({
      data: {
        leagueId,
        fantasyTeamId: team.id,
        playerId,
        dropPlayerId: dropPlayerId ?? undefined,
        priorityNumberAtSubmit: priorityNumber,
      },
      select: {
        id: true,
        playerId: true,
        dropPlayerId: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ claim });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/waivers/claim error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
