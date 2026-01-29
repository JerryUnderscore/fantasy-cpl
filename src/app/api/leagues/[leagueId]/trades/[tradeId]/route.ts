import { NextRequest, NextResponse } from "next/server";
import { MatchWeekStatus, PlayerPosition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { validateRosterComposition } from "@/lib/roster";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string; tradeId: string }> };

type TradeActionPayload = {
  action?: "ACCEPT" | "DECLINE" | "CANCEL";
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const buildRosterAfterTrade = (
  rosterSlots: Array<{
    playerId: string | null;
    player: { position: PlayerPosition; clubId: string } | null;
  }>,
  outgoingIds: Set<string>,
  incomingSlots: Array<{
    playerId: string | null;
    player: { position: PlayerPosition; clubId: string } | null;
  }>,
  incomingIds: Set<string>,
) => {
  const remaining = rosterSlots
    .filter((slot) => slot.playerId && !outgoingIds.has(slot.playerId))
    .map((slot) => slot.player!);
  const incoming = incomingSlots
    .filter((slot) => slot.playerId && incomingIds.has(slot.playerId))
    .map((slot) => slot.player!);
  const merged = [...remaining, ...incoming];
  return {
    positions: merged.map((player) => player.position),
    clubIds: merged.map((player) => player.clubId ?? null),
  };
};

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId, tradeId } = await ctx.params;

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

    const body = (await request.json().catch(() => null)) as
      | TradeActionPayload
      | null;
    const action = body?.action ?? null;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, leagueId },
      include: {
        league: { select: { id: true, seasonId: true, rosterSize: true } },
        items: { select: { playerId: true, direction: true } },
      },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (action === "CANCEL") {
      if (trade.offeredByTeamId !== team.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (trade.status !== "PENDING") {
        return NextResponse.json(
          { error: "Trade is no longer pending" },
          { status: 409 },
        );
      }
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: "CANCELED" },
      });
      return NextResponse.json({ ok: true });
    }

    if (trade.offeredToTeamId !== team.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (trade.status !== "PENDING") {
      return NextResponse.json(
        { error: "Trade is no longer pending" },
        { status: 409 },
      );
    }

    if (action === "DECLINE") {
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: "DECLINED" },
      });
      return NextResponse.json({ ok: true });
    }

    if (action !== "ACCEPT") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const offeredPlayerIds = trade.items
      .filter((item) => item.direction === "FROM_OFFERING")
      .map((item) => item.playerId);
    const requestedPlayerIds = trade.items
      .filter((item) => item.direction === "FROM_RECEIVING")
      .map((item) => item.playerId);

    if (
      offeredPlayerIds.length === 0 ||
      requestedPlayerIds.length === 0 ||
      offeredPlayerIds.length !== requestedPlayerIds.length
    ) {
      return NextResponse.json(
        { error: "Trade must exchange the same number of players" },
        { status: 409 },
      );
    }

    const offeredSet = new Set(offeredPlayerIds);
    const requestedSet = new Set(requestedPlayerIds);

    const [offeringSlots, receivingSlots] = await Promise.all([
      prisma.rosterSlot.findMany({
        where: {
          fantasyTeamId: trade.offeredByTeamId,
          playerId: { in: offeredPlayerIds },
        },
        select: {
          id: true,
          slotNumber: true,
          playerId: true,
          player: { select: { position: true, clubId: true } },
        },
      }),
      prisma.rosterSlot.findMany({
        where: {
          fantasyTeamId: trade.offeredToTeamId,
          playerId: { in: requestedPlayerIds },
        },
        select: {
          id: true,
          slotNumber: true,
          playerId: true,
          player: { select: { position: true, clubId: true } },
        },
      }),
    ]);

    if (offeringSlots.length !== offeredPlayerIds.length) {
      return NextResponse.json(
        { error: "Offered players are no longer on the roster" },
        { status: 409 },
      );
    }

    if (receivingSlots.length !== requestedPlayerIds.length) {
      return NextResponse.json(
        { error: "Requested players are no longer on the roster" },
        { status: 409 },
      );
    }

    const currentMatchWeek = await getCurrentMatchWeekForSeason(
      trade.league.seasonId,
    );

    if (currentMatchWeek && currentMatchWeek.status !== MatchWeekStatus.OPEN) {
      const outgoingSlotIds = [
        ...offeringSlots.map((slot) => slot.id),
        ...receivingSlots.map((slot) => slot.id),
      ];

      const lockedStarters = await prisma.teamMatchWeekLineupSlot.findMany({
        where: {
          matchWeekId: currentMatchWeek.id,
          rosterSlotId: { in: outgoingSlotIds },
          isStarter: true,
        },
        select: { rosterSlotId: true },
      });

      if (lockedStarters.length > 0) {
        return NextResponse.json(
          { error: "Cannot trade a starter while the matchweek is locked" },
          { status: 409 },
        );
      }
    }

    const [offeringRoster, receivingRoster] = await Promise.all([
      prisma.rosterSlot.findMany({
        where: { fantasyTeamId: trade.offeredByTeamId, playerId: { not: null } },
        select: {
          playerId: true,
          player: { select: { position: true, clubId: true } },
        },
      }),
      prisma.rosterSlot.findMany({
        where: { fantasyTeamId: trade.offeredToTeamId, playerId: { not: null } },
        select: {
          playerId: true,
          player: { select: { position: true, clubId: true } },
        },
      }),
    ]);

    const offeringRosterAfter = buildRosterAfterTrade(
      offeringRoster,
      offeredSet,
      receivingRoster,
      requestedSet,
    );
    const receivingRosterAfter = buildRosterAfterTrade(
      receivingRoster,
      requestedSet,
      offeringRoster,
      offeredSet,
    );

    const offeringValidation = validateRosterComposition({
      rosterSize: trade.league.rosterSize,
      positions: offeringRosterAfter.positions,
      clubIds: offeringRosterAfter.clubIds,
    });
    if (!offeringValidation.ok) {
      return NextResponse.json({ error: offeringValidation.error }, { status: 409 });
    }

    const receivingValidation = validateRosterComposition({
      rosterSize: trade.league.rosterSize,
      positions: receivingRosterAfter.positions,
      clubIds: receivingRosterAfter.clubIds,
    });
    if (!receivingValidation.ok) {
      return NextResponse.json({ error: receivingValidation.error }, { status: 409 });
    }

    const offeringSlotByPlayer = new Map(
      offeringSlots.map((slot) => [slot.playerId, slot]),
    );
    const receivingSlotByPlayer = new Map(
      receivingSlots.map((slot) => [slot.playerId, slot]),
    );

    const orderedOfferingSlots = offeredPlayerIds.map((playerId) =>
      offeringSlotByPlayer.get(playerId),
    );
    const orderedReceivingSlots = requestedPlayerIds.map((playerId) =>
      receivingSlotByPlayer.get(playerId),
    );

    if (
      orderedOfferingSlots.some((slot) => !slot) ||
      orderedReceivingSlots.some((slot) => !slot)
    ) {
      return NextResponse.json(
        { error: "Trade players are no longer available" },
        { status: 409 },
      );
    }

    const startNumber = currentMatchWeek
      ? currentMatchWeek.status === MatchWeekStatus.OPEN
        ? currentMatchWeek.number
        : currentMatchWeek.number + 1
      : null;

    await prisma.$transaction(async (tx) => {
      const offeringSlotUpdates = orderedOfferingSlots.map((slot, index) => ({
        teamId: trade.offeredByTeamId,
        slotId: slot!.id,
        slotNumber: slot!.slotNumber,
        playerId: requestedPlayerIds[index],
        position: receivingSlotByPlayer.get(requestedPlayerIds[index])!.player!
          .position,
      }));
      const receivingSlotUpdates = orderedReceivingSlots.map((slot, index) => ({
        teamId: trade.offeredToTeamId,
        slotId: slot!.id,
        slotNumber: slot!.slotNumber,
        playerId: offeredPlayerIds[index],
        position: offeringSlotByPlayer.get(offeredPlayerIds[index])!.player!
          .position,
      }));

      const slotsToClear = [
        ...(orderedOfferingSlots as NonNullable<(typeof orderedOfferingSlots)[number]>[]),
        ...(orderedReceivingSlots as NonNullable<(typeof orderedReceivingSlots)[number]>[]),
      ];

      for (const slot of slotsToClear) {
        await tx.rosterSlot.update({
          where: { id: slot.id },
          data: { playerId: null, isStarter: false, position: PlayerPosition.MID },
        });
      }

      for (const update of offeringSlotUpdates) {
        await tx.rosterSlot.update({
          where: { id: update.slotId },
          data: {
            playerId: update.playerId,
            isStarter: false,
            position: update.position,
          },
        });
      }

      for (const update of receivingSlotUpdates) {
        await tx.rosterSlot.update({
          where: { id: update.slotId },
          data: {
            playerId: update.playerId,
            isStarter: false,
            position: update.position,
          },
        });
      }

      await tx.trade.update({
        where: { id: trade.id },
        data: { status: "ACCEPTED" },
      });

      if (!startNumber) return;

      const matchWeeks = await tx.matchWeek.findMany({
        where: {
          seasonId: trade.league.seasonId,
          number: { gte: startNumber },
          status: { not: MatchWeekStatus.FINALIZED },
        },
        select: { id: true },
      });

      const matchWeekIds = matchWeeks.map((matchWeek) => matchWeek.id);
      if (matchWeekIds.length === 0) return;

      const affectedSlots = [...offeringSlotUpdates, ...receivingSlotUpdates];

      for (const matchWeekId of matchWeekIds) {
        for (const slot of affectedSlots) {
          await tx.teamMatchWeekLineupSlot.upsert({
            where: {
              fantasyTeamId_matchWeekId_rosterSlotId: {
                fantasyTeamId: slot.teamId,
                matchWeekId,
                rosterSlotId: slot.slotId,
              },
            },
            create: {
              fantasyTeamId: slot.teamId,
              matchWeekId,
              rosterSlotId: slot.slotId,
              slotNumber: slot.slotNumber,
              playerId: slot.playerId,
              isStarter: false,
            },
            update: { playerId: slot.playerId, isStarter: false },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/leagues/[leagueId]/trades/[tradeId] error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
