import { NextRequest, NextResponse } from "next/server";
import { MatchWeekStatus, PlayerPosition, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { buildRosterSlots, validateRosterAddition } from "@/lib/roster";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { getNextEasternTimeAt } from "@/lib/time";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type RosterSlotView = {
  id: string;
  slotNumber: number;
  position: string;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  } | null;
};

const STARTERS_REQUIRED = 11;

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const serializeSlots = (
  slots: Array<{
    id: string;
    slotNumber: number;
    position: string;
    isStarter: boolean;
    player: {
      id: string;
      name: string;
      jerseyNumber: number | null;
      position: string;
      club: { shortName: string | null; slug: string } | null;
      active: boolean;
    } | null;
  }>,
): RosterSlotView[] =>
  slots.map((slot) => ({
    id: slot.id,
    slotNumber: slot.slotNumber,
    position: slot.position,
    isStarter: slot.isStarter,
    player: slot.player
      ? {
          id: slot.player.id,
          name: slot.player.name,
          jerseyNumber: slot.player.jerseyNumber,
          position: slot.player.position,
          club: slot.player.club,
        }
      : null,
  }));

const clearInactivePlayers = async (
  slots: Array<{
    id: string;
    slotNumber: number;
    position: string;
    playerId: string | null;
    isStarter: boolean;
    player: {
      id: string;
      name: string;
      position: string;
      club: { shortName: string | null; slug: string } | null;
      active: boolean;
    } | null;
  }>,
) => {
  const inactiveSlotIds = slots
    .filter((slot) => slot.player && !slot.player.active)
    .map((slot) => slot.id);

  if (inactiveSlotIds.length === 0) {
    return slots;
  }

  await prisma.rosterSlot.updateMany({
    where: { id: { in: inactiveSlotIds } },
    data: { playerId: null, isStarter: false },
  });

  return slots.map((slot) =>
    inactiveSlotIds.includes(slot.id)
      ? { ...slot, playerId: null, player: null, isStarter: false }
      : slot,
  );
};

const loadRosterSlots = (fantasyTeamId: string) =>
  prisma.rosterSlot.findMany({
    where: { fantasyTeamId },
    orderBy: { slotNumber: "asc" },
    select: {
      id: true,
      slotNumber: true,
      position: true,
      playerId: true,
      isStarter: true,
      player: {
        select: {
          id: true,
          name: true,
          jerseyNumber: true,
          position: true,
          active: true,
          club: { select: { shortName: true, slug: true } },
        },
      },
    },
  });

const loadLineupSlots = (fantasyTeamId: string, matchWeekId: string) =>
  prisma.teamMatchWeekLineupSlot.findMany({
    where: { fantasyTeamId, matchWeekId },
    orderBy: { slotNumber: "asc" },
    select: {
      rosterSlotId: true,
      slotNumber: true,
      playerId: true,
      isStarter: true,
      rosterSlot: { select: { position: true } },
      player: {
        select: {
          id: true,
          name: true,
          jerseyNumber: true,
          position: true,
          active: true,
          club: { select: { shortName: true, slug: true } },
        },
      },
    },
  });

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

const ensureLineupSlots = async (
  fantasyTeamId: string,
  matchWeek: { id: string; number: number; seasonId: string },
  rosterSlots: Array<{
    id: string;
    slotNumber: number;
    playerId: string | null;
    isStarter: boolean;
  }>,
) => {
  const existingSlots = await prisma.teamMatchWeekLineupSlot.findMany({
    where: { fantasyTeamId, matchWeekId: matchWeek.id },
    select: { rosterSlotId: true },
  });

  const existingSlotIds = new Set(
    existingSlots.map((slot) => slot.rosterSlotId),
  );
  const missingSlots = rosterSlots.filter((slot) => !existingSlotIds.has(slot.id));

  if (missingSlots.length > 0) {
    const seedStarterMap = await findSeedStarterMap(
      fantasyTeamId,
      matchWeek.seasonId,
      matchWeek.number,
    );
    await prisma.teamMatchWeekLineupSlot.createMany({
      data: missingSlots.map((slot) => ({
        fantasyTeamId,
        matchWeekId: matchWeek.id,
        rosterSlotId: slot.id,
        slotNumber: slot.slotNumber,
        playerId: slot.playerId ?? null,
        isStarter: slot.playerId
          ? (seedStarterMap?.get(slot.id) ?? slot.isStarter)
          : false,
      })),
    });
  }

  return loadLineupSlots(fantasyTeamId, matchWeek.id);
};

const parseMatchWeekNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const getRosterPropagationStartNumber = async (seasonId: string) => {
  const currentMatchWeek = await getCurrentMatchWeekForSeason(seasonId);
  if (!currentMatchWeek) return null;
  if (currentMatchWeek.status === MatchWeekStatus.OPEN) {
    return currentMatchWeek.number;
  }
  return currentMatchWeek.number + 1;
};

const syncLineupSlotsForRosterChange = async ({
  fantasyTeamId,
  seasonId,
  rosterSlots,
  affectedSlotIds,
}: {
  fantasyTeamId: string;
  seasonId: string;
  rosterSlots: Array<{
    id: string;
    slotNumber: number;
    playerId: string | null;
    isStarter: boolean;
  }>;
  affectedSlotIds: string[];
}) => {
  const startNumber = await getRosterPropagationStartNumber(seasonId);
  if (!startNumber) return;

  const matchWeeks = await prisma.matchWeek.findMany({
    where: {
      seasonId,
      number: { gte: startNumber },
      status: { not: MatchWeekStatus.FINALIZED },
    },
    select: { id: true, number: true },
  });

  if (matchWeeks.length === 0) return;

  const slotMap = new Map(
    rosterSlots.map((slot) => [slot.id, slot]),
  );

  for (const matchWeek of matchWeeks) {
    await ensureLineupSlots(
      fantasyTeamId,
      { id: matchWeek.id, number: matchWeek.number, seasonId },
      rosterSlots,
    );

    for (const slotId of affectedSlotIds) {
      const slot = slotMap.get(slotId);
      if (!slot) continue;

      const updateData: Prisma.TeamMatchWeekLineupSlotUpdateInput = {
        playerId: slot.playerId ?? null,
      };

      if (!slot.playerId) {
        updateData.isStarter = false;
      }

      await prisma.teamMatchWeekLineupSlot.update({
        where: {
          fantasyTeamId_matchWeekId_rosterSlotId: {
            fantasyTeamId,
            matchWeekId: matchWeek.id,
            rosterSlotId: slot.id,
          },
        },
        data: updateData,
      });
    }
  }
};

export async function GET(request: NextRequest, ctx: Ctx) {
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
      select: { id: true, seasonId: true, rosterSize: true },
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
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(team.id, leagueId, league.rosterSize),
      skipDuplicates: true,
    });

    const matchWeekParam = request.nextUrl.searchParams.get("matchWeek");
    const requestedMatchWeekNumber = parseMatchWeekNumber(matchWeekParam);

    const currentMatchWeek = await getCurrentMatchWeekForSeason(league.seasonId);
    const fallbackMatchWeek = currentMatchWeek
      ? null
      : await prisma.matchWeek.findFirst({
          where: { seasonId: league.seasonId, status: MatchWeekStatus.FINALIZED },
          orderBy: { number: "asc" },
          select: { id: true, number: true, status: true },
        });

    const selectedMatchWeek = requestedMatchWeekNumber
      ? await prisma.matchWeek.findUnique({
          where: {
            seasonId_number: {
              seasonId: league.seasonId,
              number: requestedMatchWeekNumber,
            },
          },
          select: { id: true, number: true, status: true },
        })
      : currentMatchWeek ?? fallbackMatchWeek;

    const lockInfo = selectedMatchWeek
      ? {
          isLocked: selectedMatchWeek.status !== MatchWeekStatus.OPEN,
          matchWeekNumber: selectedMatchWeek.number,
          status: selectedMatchWeek.status,
        }
      : null;

    const slots = await loadRosterSlots(team.id);
    const sanitizedSlots = await clearInactivePlayers(slots);

    if (!selectedMatchWeek) {
      return NextResponse.json({
        team,
        slots: serializeSlots(sanitizedSlots),
        lockInfo,
      });
    }

    const lineupSlots = await ensureLineupSlots(
      team.id,
      {
        id: selectedMatchWeek.id,
        number: selectedMatchWeek.number,
        seasonId: league.seasonId,
      },
      sanitizedSlots,
    );

    if (selectedMatchWeek.status !== MatchWeekStatus.OPEN) {
      const lockedSlots: RosterSlotView[] = lineupSlots.map((slot) => ({
        id: slot.rosterSlotId,
        slotNumber: slot.slotNumber,
        position: slot.rosterSlot.position,
        isStarter: slot.isStarter,
        player: slot.player
          ? {
              id: slot.player.id,
              name: slot.player.name,
              jerseyNumber: slot.player.jerseyNumber,
              position: slot.player.position,
              club: slot.player.club,
            }
          : null,
      }));

      return NextResponse.json({
        team,
        slots: lockedSlots,
        lockInfo,
      });
    }

    const lineupBySlotId = new Map(
      lineupSlots.map((slot) => [slot.rosterSlotId, slot]),
    );

    const openSlots: RosterSlotView[] = sanitizedSlots.map((slot) => {
      const lineup = lineupBySlotId.get(slot.id);
      const isStarter =
        Boolean(lineup) &&
        lineup?.playerId === slot.playerId &&
        Boolean(lineup?.isStarter);

      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        position: slot.position,
        isStarter,
        player: slot.player
          ? {
              id: slot.player.id,
              name: slot.player.name,
              jerseyNumber: slot.player.jerseyNumber,
              position: slot.player.position,
              club: slot.player.club,
            }
          : null,
      };
    });

    return NextResponse.json({
      team,
      slots: openSlots,
      lockInfo,
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
      select: { id: true, seasonId: true, waiverPeriodHours: true, rosterSize: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Default waiver window (hours) if unset/null/invalid
    const waiverHours =
      typeof league.waiverPeriodHours === "number" &&
      Number.isFinite(league.waiverPeriodHours) &&
      league.waiverPeriodHours >= 0
        ? league.waiverPeriodHours
        : 24;

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

    // Current matchweek semantics should already be:
    // lowest-number OPEN, else lowest-number LOCKED, else null.
    const lockingMatchWeek = await getCurrentMatchWeekForSeason(league.seasonId);
    const isLocked =
      lockingMatchWeek != null && lockingMatchWeek.status !== MatchWeekStatus.OPEN;

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(team.id, leagueId, league.rosterSize),
      skipDuplicates: true,
    });

    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : null;
    const requestedMatchWeekNumber = parseMatchWeekNumber(body?.matchWeekNumber);
    const selectedMatchWeek = requestedMatchWeekNumber
      ? await prisma.matchWeek.findUnique({
          where: {
            seasonId_number: {
              seasonId: league.seasonId,
              number: requestedMatchWeekNumber,
            },
          },
          select: { id: true, number: true, status: true },
        })
      : null;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (selectedMatchWeek) {
      const initialSlots = await loadRosterSlots(team.id);
      const sanitizedInitialSlots = await clearInactivePlayers(initialSlots);
      await ensureLineupSlots(
        team.id,
        {
          id: selectedMatchWeek.id,
          number: selectedMatchWeek.number,
          seasonId: league.seasonId,
        },
        sanitizedInitialSlots,
      );
    }

    // During LOCKED/FINALIZED: allow only "clear" (drops).
    if (isLocked && action !== "clear" && action !== "starter") {
      return NextResponse.json(
        {
          error: `Lineups are locked for MatchWeek ${lockingMatchWeek?.number ?? "?"}`,
        },
        { status: 409 },
      );
    }

    let affectedSlotIds: string[] = [];

    if (action === "assign") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;
      const playerId = typeof body?.playerId === "string" ? body.playerId : null;

      if (!slotId || !playerId) {
        return NextResponse.json(
          { error: "slotId and playerId are required" },
          { status: 400 },
        );
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: {
          id: true,
          slotNumber: true,
          playerId: true,
          player: { select: { position: true } },
        },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, seasonId: true, active: true, position: true },
      });

      if (!player || !player.active || player.seasonId !== league.seasonId) {
        return NextResponse.json({ error: "Player not available" }, { status: 400 });
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
        return NextResponse.json({ error: "Player not drafted" }, { status: 400 });
      }

      if (draftPick.fantasyTeamId !== team.id) {
        return NextResponse.json(
          { error: "Player drafted by another team" },
          { status: 403 },
        );
      }

      // Same-team duplication check (should be redundant if DB constraints exist, but good UX)
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

      // League-level uniqueness enforcement (one rostered instance per league)
      const leagueConflict = await prisma.rosterSlot.findFirst({
        where: {
          leagueId,
          playerId,
          fantasyTeamId: { not: team.id },
        },
        select: { id: true },
      });

      if (leagueConflict) {
        return NextResponse.json(
          { error: "Player already rostered in this league" },
          { status: 409 },
        );
      }

      const rosterPositions = await prisma.rosterSlot.findMany({
        where: { fantasyTeamId: team.id, playerId: { not: null } },
        select: { player: { select: { position: true } } },
      });
      const currentPositions = rosterPositions
        .map((row) => row.player?.position)
        .filter((position): position is PlayerPosition => Boolean(position));
      const validation = validateRosterAddition({
        rosterSize: league.rosterSize,
        currentPositions,
        addPosition: player.position,
        dropPosition: slot.player?.position ?? null,
      });

      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 409 });
      }

      await prisma.rosterSlot.update({
        where: { id: slotId },
        data: { playerId, position: player.position },
      });
      affectedSlotIds = [slotId];
    } else if (action === "clear") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;

      if (!slotId) {
        return NextResponse.json({ error: "slotId is required" }, { status: 400 });
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: { id: true, slotNumber: true, isStarter: true, playerId: true },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      let slotIsStarter = slot.isStarter;

      if (lockingMatchWeek) {
        const lineupSlot = await prisma.teamMatchWeekLineupSlot.findUnique({
          where: {
            fantasyTeamId_matchWeekId_rosterSlotId: {
              fantasyTeamId: team.id,
              matchWeekId: lockingMatchWeek.id,
              rosterSlotId: slot.id,
            },
          },
          select: { isStarter: true },
        });
        if (lineupSlot) {
          slotIsStarter = lineupSlot.isStarter;
        }
      }

      if (selectedMatchWeek?.id) {
        const lineupSlot = await prisma.teamMatchWeekLineupSlot.findUnique({
          where: {
            fantasyTeamId_matchWeekId_rosterSlotId: {
              fantasyTeamId: team.id,
              matchWeekId: selectedMatchWeek.id,
              rosterSlotId: slot.id,
            },
          },
          select: { isStarter: true },
        });
        if (lineupSlot) {
          slotIsStarter = lineupSlot.isStarter;
        }
      }

      // Prevent starter drops during LOCKED/FINALIZED
      if (slotIsStarter && isLocked) {
        return NextResponse.json(
          {
            error: `Cannot drop a starter while MatchWeek ${
              lockingMatchWeek?.number ?? "?"
            } is locked`,
          },
          { status: 409 },
        );
      }

      // Even when OPEN, you must bench first (no dropping starters directly)
      if (slotIsStarter) {
        return NextResponse.json(
          { error: "Cannot drop a starter. Bench them first." },
          { status: 409 },
        );
      }

      const waiverAvailableAt = slot.playerId
        ? getNextEasternTimeAt(new Date(), 4, 0) ??
          new Date(Date.now() + waiverHours * 60 * 60 * 1000)
        : null;

      await prisma.$transaction(async (tx) => {
        await tx.rosterSlot.update({
          where: { id: slotId },
          data: {
            playerId: null,
            isStarter: false,
            position: PlayerPosition.MID,
          },
        });

        if (slot.playerId && waiverAvailableAt) {
          await tx.leaguePlayerWaiver.upsert({
            where: {
              leagueId_playerId: {
                leagueId,
                playerId: slot.playerId,
              },
            },
            update: { waiverAvailableAt },
            create: {
              leagueId,
              playerId: slot.playerId,
              waiverAvailableAt,
            },
          });
        }
      });
      affectedSlotIds = [slotId];
    } else if (action === "starter") {
      const slotId = typeof body?.slotId === "string" ? body.slotId : null;
      const isStarter = typeof body?.isStarter === "boolean" ? body.isStarter : null;

      if (!slotId || isStarter === null) {
        return NextResponse.json(
          { error: "slotId and isStarter are required" },
          { status: 400 },
        );
      }

      if (!selectedMatchWeek) {
        return NextResponse.json(
          { error: "matchWeekNumber is required" },
          { status: 400 },
        );
      }

      if (selectedMatchWeek.status !== MatchWeekStatus.OPEN) {
        return NextResponse.json(
          { error: "Lineups are locked for this MatchWeek" },
          { status: 409 },
        );
      }

      const slot = await prisma.rosterSlot.findFirst({
        where: { id: slotId, fantasyTeamId: team.id },
        select: { id: true, playerId: true, slotNumber: true },
      });

      if (!slot) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      if (isStarter && !slot.playerId) {
        return NextResponse.json({ error: "Slot has no player" }, { status: 400 });
      }

      if (isStarter) {
        const startersCount = await prisma.teamMatchWeekLineupSlot.count({
          where: {
            fantasyTeamId: team.id,
            matchWeekId: selectedMatchWeek.id,
            isStarter: true,
            playerId: { not: null },
            rosterSlotId: { not: slot.id },
          },
        });

        if (startersCount >= STARTERS_REQUIRED) {
          return NextResponse.json(
            { error: "Starter limit reached", details: { limit: STARTERS_REQUIRED } },
            { status: 409 },
          );
        }
      }

      await prisma.teamMatchWeekLineupSlot.upsert({
        where: {
          fantasyTeamId_matchWeekId_rosterSlotId: {
            fantasyTeamId: team.id,
            matchWeekId: selectedMatchWeek.id,
            rosterSlotId: slotId,
          },
        },
        create: {
          fantasyTeamId: team.id,
          matchWeekId: selectedMatchWeek.id,
          rosterSlotId: slotId,
          slotNumber: slot.slotNumber,
          playerId: slot.playerId,
          isStarter,
        },
        update: { isStarter, playerId: slot.playerId },
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
        return NextResponse.json({ error: "Slots must be different" }, { status: 400 });
      }

      const slots = await prisma.rosterSlot.findMany({
        where: { id: { in: [slotId, targetSlotId] }, fantasyTeamId: team.id },
        select: {
          id: true,
          playerId: true,
          slotNumber: true,
          player: { select: { position: true } },
        },
      });

      if (slots.length !== 2) {
        return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      }

      const [slotA, slotB] =
        slots[0].id === slotId ? [slots[0], slots[1]] : [slots[1], slots[0]];

      const slotAPosition =
        slotA.playerId && slotA.player?.position
          ? slotA.player.position
          : PlayerPosition.MID;
      const slotBPosition =
        slotB.playerId && slotB.player?.position
          ? slotB.player.position
          : PlayerPosition.MID;

      await prisma.$transaction(async (tx) => {
        await tx.rosterSlot.update({
          where: { id: slotA.id },
          data: { playerId: null, position: PlayerPosition.MID },
        });
        await tx.rosterSlot.update({
          where: { id: slotB.id },
          data: { playerId: slotA.playerId, position: slotAPosition },
        });
        await tx.rosterSlot.update({
          where: { id: slotA.id },
          data: { playerId: slotB.playerId, position: slotBPosition },
        });
      });
      affectedSlotIds = [slotA.id, slotB.id];
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const slots = await loadRosterSlots(team.id);
    const sanitizedSlots = await clearInactivePlayers(slots);

    if (!selectedMatchWeek) {
      return NextResponse.json({
        slots: serializeSlots(sanitizedSlots),
      });
    }

    const lineupSlots = await ensureLineupSlots(
      team.id,
      {
        id: selectedMatchWeek.id,
        number: selectedMatchWeek.number,
        seasonId: league.seasonId,
      },
      sanitizedSlots,
    );
    const lineupBySlotId = new Map(
      lineupSlots.map((slot) => [slot.rosterSlotId, slot]),
    );

    const responseSlots: RosterSlotView[] = sanitizedSlots.map((slot) => {
      const lineup = lineupBySlotId.get(slot.id);
      const isStarter =
        Boolean(lineup) &&
        lineup?.playerId === slot.playerId &&
        Boolean(lineup?.isStarter);

      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        position: slot.position,
        isStarter,
        player: slot.player
          ? {
              id: slot.player.id,
              name: slot.player.name,
              jerseyNumber: slot.player.jerseyNumber,
              position: slot.player.position,
              club: slot.player.club,
            }
          : null,
      };
    });

    return NextResponse.json({
      slots: responseSlots,
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
        { error: "Player already rostered in this league" },
        { status: 409 },
      );
    }
    console.error("PATCH /api/leagues/[leagueId]/team/roster error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
