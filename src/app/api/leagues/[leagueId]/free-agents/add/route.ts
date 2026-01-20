import { NextRequest, NextResponse } from "next/server";
import { MatchWeekStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { getNextEasternTimeAt } from "@/lib/time";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const getRosterPropagationStartNumber = async (seasonId: string) => {
  const currentMatchWeek = await getCurrentMatchWeekForSeason(seasonId);
  if (!currentMatchWeek) return null;
  if (currentMatchWeek.status === MatchWeekStatus.OPEN) {
    return currentMatchWeek.number;
  }
  return currentMatchWeek.number + 1;
};

const findSeedStarterMap = async (
  fantasyTeamId: string,
  seasonId: string,
  matchWeekNumber: number,
) => {
  const priorMatchWeek = await prisma.teamMatchWeekLineupSlot.findMany({
    where: {
      fantasyTeamId,
      matchWeek: { seasonId, number: { lt: matchWeekNumber } },
    },
    distinct: ["matchWeekId"],
    orderBy: { matchWeek: { number: "desc" } },
    take: 1,
    select: { matchWeekId: true },
  });

  const priorMatchWeekId = priorMatchWeek[0]?.matchWeekId;
  if (!priorMatchWeekId) return null;

  const priorSlots = await prisma.teamMatchWeekLineupSlot.findMany({
    where: { fantasyTeamId, matchWeekId: priorMatchWeekId },
    select: { rosterSlotId: true, isStarter: true },
  });

  return new Map(priorSlots.map((slot) => [slot.rosterSlotId, slot.isStarter]));
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
      select: {
        id: true,
        seasonId: true,
        waiverPeriodHours: true,
        draftMode: true,
      },
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
      select: { id: true, seasonId: true, active: true },
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
    if (waiver && waiver.waiverAvailableAt > now) {
      return NextResponse.json(
        { error: "Player is on waivers" },
        { status: 409 },
      );
    }

    const slots = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: team.id },
      select: { id: true, slotNumber: true, playerId: true, isStarter: true },
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

    if (!emptySlot && !dropSlot) {
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

    const targetSlot = dropSlot ?? emptySlot ?? null;
    const targetSlotId = targetSlot?.id ?? null;
    if (!targetSlotId) {
      return NextResponse.json(
        { error: "No available roster slot" },
        { status: 409 },
      );
    }

    const fallbackHours =
      typeof league.waiverPeriodHours === "number" &&
      Number.isFinite(league.waiverPeriodHours) &&
      league.waiverPeriodHours >= 0
        ? league.waiverPeriodHours
        : 24;
    const waiverAvailableAt = dropSlot?.playerId
      ? getNextEasternTimeAt(now, 4, 0) ??
        new Date(now.getTime() + fallbackHours * 60 * 60 * 1000)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.rosterSlot.update({
        where: { id: targetSlotId },
        data: { playerId, isStarter: false },
      });

      if (dropSlot?.playerId && waiverAvailableAt) {
        await tx.leaguePlayerWaiver.upsert({
          where: {
            leagueId_playerId: {
              leagueId,
              playerId: dropSlot.playerId,
            },
          },
          update: { waiverAvailableAt },
          create: {
            leagueId,
            playerId: dropSlot.playerId,
            waiverAvailableAt,
          },
        });
      }
    });

    const updatedSlots = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: team.id },
      orderBy: { slotNumber: "asc" },
      select: {
        id: true,
        slotNumber: true,
        isStarter: true,
        playerId: true,
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            club: { select: { shortName: true, slug: true } },
          },
        },
      },
    });

    const startNumber = await getRosterPropagationStartNumber(league.seasonId);
    if (startNumber !== null) {
      const matchWeeks = await prisma.matchWeek.findMany({
        where: {
          seasonId: league.seasonId,
          number: { gte: startNumber },
          status: { not: MatchWeekStatus.FINALIZED },
        },
        select: { id: true, number: true },
      });

      for (const matchWeek of matchWeeks) {
        const existingSlots = await prisma.teamMatchWeekLineupSlot.findMany({
          where: { fantasyTeamId: team.id, matchWeekId: matchWeek.id },
          select: { rosterSlotId: true },
        });
        const existingSlotIds = new Set(
          existingSlots.map((slot) => slot.rosterSlotId),
        );
        const missingSlots = updatedSlots.filter(
          (slot) => !existingSlotIds.has(slot.id),
        );

        if (missingSlots.length > 0) {
          const seedStarterMap = await findSeedStarterMap(
            team.id,
            league.seasonId,
            matchWeek.number,
          );
          await prisma.teamMatchWeekLineupSlot.createMany({
            data: missingSlots.map((slot) => ({
              fantasyTeamId: team.id,
              matchWeekId: matchWeek.id,
              rosterSlotId: slot.id,
              slotNumber: slot.slotNumber,
              playerId: slot.playerId ?? null,
              isStarter: seedStarterMap?.get(slot.id) ?? slot.isStarter,
            })),
          });
        }

        if (targetSlot) {
          await prisma.teamMatchWeekLineupSlot.update({
            where: {
              fantasyTeamId_matchWeekId_rosterSlotId: {
                fantasyTeamId: team.id,
                matchWeekId: matchWeek.id,
                rosterSlotId: targetSlot.id,
              },
            },
            data: { playerId, isStarter: false },
          });
        }
      }
    }

    return NextResponse.json({ slots: updatedSlots });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/free-agents/add error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
