import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { PlayerPosition } from "@prisma/client";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type RosterSlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  } | null;
};

const ROSTER_SIZE = 15;

const buildRosterSlots = (fantasyTeamId: string) =>
  Array.from({ length: ROSTER_SIZE }, (_, index) => ({
    fantasyTeamId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const serializeSlots = (slots: Array<{
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  } | null;
}>): RosterSlotView[] =>
  slots.map((slot) => ({
    id: slot.id,
    slotNumber: slot.slotNumber,
    isStarter: slot.isStarter,
    player: slot.player
      ? {
          id: slot.player.id,
          name: slot.player.name,
          position: slot.player.position,
          club: slot.player.club,
        }
      : null,
  }));

const loadRosterSlots = (fantasyTeamId: string) =>
  prisma.rosterSlot.findMany({
    where: { fantasyTeamId },
    orderBy: { slotNumber: "asc" },
    select: {
      id: true,
      slotNumber: true,
      isStarter: true,
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

export async function GET(_request: NextRequest, ctx: Ctx) {
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

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(team.id),
      skipDuplicates: true,
    });

    const slots = await loadRosterSlots(team.id);

    return NextResponse.json({
      team,
      slots: serializeSlots(slots),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/team/roster error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
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
      select: { id: true, seasonId: true },
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

const currentMatchWeek = await getCurrentMatchWeekForSeason(league.seasonId);

if (currentMatchWeek && currentMatchWeek.status !== "OPEN") {
  return NextResponse.json(
    { error: `Lineups are locked for MatchWeek ${currentMatchWeek.number}` },
    { status: 409 },
  );
}

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(team.id),
      skipDuplicates: true,
    });

    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : null;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "assign") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;
      const playerId =
        typeof body?.playerId === "string" ? body.playerId : null;

      if (!slotId || !playerId) {
        return NextResponse.json(
          { error: "slotId and playerId are required" },
          { status: 400 },
        );
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: { id: true },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, seasonId: true },
      });

      if (!player || player.seasonId !== league.seasonId) {
        return NextResponse.json(
          { error: "Player not available" },
          { status: 400 },
        );
      }

      const draft = await prisma.draft.findUnique({
        where: { leagueId_seasonId: { leagueId, seasonId: league.seasonId } },
        select: { id: true },
      });

      if (!draft) {
        return NextResponse.json({ error: "Draft not found" }, { status: 400 });
      }

      const draftPick = await prisma.draftPick.findUnique({
        where: { draftId_playerId: { draftId: draft.id, playerId } },
        select: { fantasyTeamId: true },
      });

      if (!draftPick) {
        return NextResponse.json(
          { error: "Player not drafted" },
          { status: 400 },
        );
      }

      if (draftPick.fantasyTeamId !== team.id) {
        return NextResponse.json(
          { error: "Player drafted by another team" },
          { status: 403 },
        );
      }

      const existingSlot = await prisma.rosterSlot.findFirst({
        where: { fantasyTeamId: team.id, playerId },
        select: { id: true },
      });

      if (existingSlot && existingSlot.id !== slotId) {
        return NextResponse.json(
          { error: "Player already on your roster" },
          { status: 409 },
        );
      }

      await prisma.rosterSlot.update({
        where: { id: slotId },
        data: { playerId },
      });
    } else if (action === "clear") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;

      if (!slotId) {
        return NextResponse.json(
          { error: "slotId is required" },
          { status: 400 },
        );
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: { id: true, isStarter: true },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      if (slot.isStarter) {
        return NextResponse.json(
          { error: "Cannot drop a starter. Bench them first." },
          { status: 409 },
        );
      }

      await prisma.rosterSlot.update({
        where: { id: slotId },
        data: { playerId: null, isStarter: false },
      });
    } else if (action === "starter") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;
      const isStarter =
        typeof body?.isStarter === "boolean" ? body.isStarter : null;

      if (!slotId || isStarter === null) {
        return NextResponse.json(
          { error: "slotId and isStarter are required" },
          { status: 400 },
        );
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: { id: true, playerId: true },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      if (isStarter && !slot.playerId) {
        return NextResponse.json(
          { error: "Slot has no player" },
          { status: 400 },
        );
      }

      await prisma.rosterSlot.update({
        where: { id: slotId },
        data: { isStarter },
      });
    } else if (action === "swap") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;
      const targetSlotId =
        typeof body?.targetSlotId === "string" ? body.targetSlotId : null;

      if (!slotId || !targetSlotId) {
        return NextResponse.json(
          { error: "slotId and targetSlotId are required" },
          { status: 400 },
        );
      }

      if (slotId === targetSlotId) {
        return NextResponse.json(
          { error: "Slots must be different" },
          { status: 400 },
        );
      }

      const slots = await prisma.rosterSlot.findMany({
        where: { id: { in: [slotId, targetSlotId] }, fantasyTeamId: team.id },
        select: { id: true, playerId: true },
      });

      if (slots.length !== 2) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      const [slotA, slotB] =
        slots[0].id === slotId
          ? [slots[0], slots[1]]
          : [slots[1], slots[0]];

      await prisma.$transaction(async (tx) => {
        await tx.rosterSlot.update({
          where: { id: slotA.id },
          data: { playerId: null },
        });
        await tx.rosterSlot.update({
          where: { id: slotB.id },
          data: { playerId: slotA.playerId },
        });
        await tx.rosterSlot.update({
          where: { id: slotA.id },
          data: { playerId: slotB.playerId },
        });
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const slots = await loadRosterSlots(team.id);

    return NextResponse.json({
      slots: serializeSlots(slots),
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
        { error: "Player already on your roster" },
        { status: 409 },
      );
    }
    console.error("PATCH /api/leagues/[leagueId]/team/roster error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
