import { MatchWeekStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNextEasternTimeAt } from "@/lib/time";

type DbClient = Prisma.TransactionClient | typeof prisma;

type LockInfo = {
  isLocked: boolean;
  matchWeekId: string | null;
  matchWeekNumber: number | null;
  status: MatchWeekStatus | null;
} | null;

type LeagueWaiverProcessResult = {
  processedCount: number;
  winnerCount: number;
  expiredCount: number;
};

type LeagueWaiverProcessSummary = {
  leagueId: string;
  result: LeagueWaiverProcessResult;
  lockInfo: LockInfo;
};

export const normalizeLeagueWaiverTimes = async (
  db: DbClient,
  leagueId: string,
  now: Date = new Date(),
) => {
  const nextReset = getNextEasternTimeAt(now, 4, 0);
  if (!nextReset) return null;

  await db.leaguePlayerWaiver.updateMany({
    where: {
      leagueId,
      waiverAvailableAt: { not: nextReset },
    },
    data: { waiverAvailableAt: nextReset },
  });

  return nextReset;
};

const getSeasonLockInfo = async (db: DbClient, seasonId: string) => {
  const select = { id: true, number: true, status: true } as const;

  const openMatchWeek = await db.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.OPEN },
    orderBy: { number: "asc" },
    select,
  });

  if (openMatchWeek) {
    return {
      isLocked: false,
      matchWeekId: openMatchWeek.id,
      matchWeekNumber: openMatchWeek.number,
      status: openMatchWeek.status,
    };
  }

  const lockedMatchWeek = await db.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.LOCKED },
    orderBy: { number: "asc" },
    select,
  });

  if (lockedMatchWeek) {
    return {
      isLocked: true,
      matchWeekId: lockedMatchWeek.id,
      matchWeekNumber: lockedMatchWeek.number,
      status: lockedMatchWeek.status,
    };
  }

  const finalizedMatchWeek = await db.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.FINALIZED },
    orderBy: { number: "asc" },
    select,
  });

  if (finalizedMatchWeek) {
    return {
      isLocked: true,
      matchWeekId: finalizedMatchWeek.id,
      matchWeekNumber: finalizedMatchWeek.number,
      status: finalizedMatchWeek.status,
    };
  }

  return null;
};

const findSeedStarterMap = async (
  db: DbClient,
  fantasyTeamId: string,
  seasonId: string,
  matchWeekNumber: number,
) => {
  const priorMatchWeek = await db.teamMatchWeekLineupSlot.findMany({
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

  const priorSlots = await db.teamMatchWeekLineupSlot.findMany({
    where: { fantasyTeamId, matchWeekId: priorMatchWeekId },
    select: { rosterSlotId: true, isStarter: true },
  });

  return new Map(priorSlots.map((slot) => [slot.rosterSlotId, slot.isStarter]));
};

export const ensureLeagueWaiverPriorities = async (
  db: DbClient,
  leagueId: string,
) => {
  const teams = await db.fantasyTeam.findMany({
    where: { leagueId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (teams.length === 0) {
    return new Map<string, number>();
  }

  const existing = await db.leagueWaiverPriority.findMany({
    where: { leagueId },
    orderBy: { priority: "asc" },
    select: { fantasyTeamId: true, priority: true },
  });

  if (existing.length === 0) {
    await db.leagueWaiverPriority.createMany({
      data: teams.map((team, index) => ({
        leagueId,
        fantasyTeamId: team.id,
        priority: index + 1,
      })),
      skipDuplicates: true,
    });
  } else {
    const existingIds = new Set(existing.map((row) => row.fantasyTeamId));
    const maxPriority = existing.reduce(
      (max, row) => Math.max(max, row.priority),
      0,
    );
    const missingTeams = teams.filter((team) => !existingIds.has(team.id));
    if (missingTeams.length > 0) {
      await db.leagueWaiverPriority.createMany({
        data: missingTeams.map((team, index) => ({
          leagueId,
          fantasyTeamId: team.id,
          priority: maxPriority + index + 1,
        })),
        skipDuplicates: true,
      });
    }
  }

  const priorities = await db.leagueWaiverPriority.findMany({
    where: { leagueId },
    orderBy: { priority: "asc" },
    select: { fantasyTeamId: true, priority: true },
  });

  return new Map(
    priorities.map((row) => [row.fantasyTeamId, row.priority]),
  );
};

export const moveWaiverPriorityToBottom = async (
  db: DbClient,
  leagueId: string,
  fantasyTeamId: string,
) => {
  const priorities = await db.leagueWaiverPriority.findMany({
    where: { leagueId },
    orderBy: { priority: "asc" },
    select: { id: true, fantasyTeamId: true, priority: true },
  });

  if (!priorities.length) {
    return new Map<string, number>();
  }

  const target = priorities.find((row) => row.fantasyTeamId === fantasyTeamId);
  if (!target) {
    return new Map(
      priorities.map((row) => [row.fantasyTeamId, row.priority]),
    );
  }

  const maxPriority = priorities[priorities.length - 1].priority;
  await db.leagueWaiverPriority.update({
    where: { id: target.id },
    data: { priority: maxPriority + 1 },
  });

  const reordered = await db.leagueWaiverPriority.findMany({
    where: { leagueId },
    orderBy: { priority: "asc" },
    select: { id: true, fantasyTeamId: true, priority: true },
  });

  for (let index = 0; index < reordered.length; index += 1) {
    const row = reordered[index];
    const nextPriority = index + 1;
    if (row.priority !== nextPriority) {
      await db.leagueWaiverPriority.update({
        where: { id: row.id },
        data: { priority: nextPriority },
      });
    }
  }

  const normalized = await db.leagueWaiverPriority.findMany({
    where: { leagueId },
    orderBy: { priority: "asc" },
    select: { fantasyTeamId: true, priority: true },
  });

  return new Map(
    normalized.map((row) => [row.fantasyTeamId, row.priority]),
  );
};

const processLeagueWaiversInTransaction = async (
  tx: Prisma.TransactionClient,
  leagueId: string,
  now: Date,
  lockInfo: LockInfo,
  seasonId: string,
) => {
  const startNumber =
    lockInfo?.matchWeekNumber != null
      ? lockInfo.status === MatchWeekStatus.OPEN
        ? lockInfo.matchWeekNumber
        : lockInfo.matchWeekNumber + 1
      : null;

  const targetMatchWeeks =
    startNumber != null
      ? await tx.matchWeek.findMany({
          where: {
            seasonId,
            number: { gte: startNumber },
            status: { not: MatchWeekStatus.FINALIZED },
          },
          select: { id: true, number: true },
        })
      : [];
  const waiverPlayers = await tx.leaguePlayerWaiver.findMany({
    where: { leagueId, waiverAvailableAt: { lte: now } },
    select: { playerId: true },
  });

  let priorityMap = await ensureLeagueWaiverPriorities(tx, leagueId);

  let processedCount = 0;
  let winnerCount = 0;
  let expiredCount = 0;

  for (const waiver of waiverPlayers) {
    const playerId = waiver.playerId;

    const pendingClaims = await tx.leagueWaiverClaim.findMany({
      where: { leagueId, playerId, status: "PENDING" },
      select: {
        id: true,
        fantasyTeamId: true,
        dropPlayerId: true,
        createdAt: true,
      },
    });

    if (pendingClaims.length === 0) {
      await tx.leaguePlayerWaiver.deleteMany({
        where: { leagueId, playerId },
      });
      processedCount += 1;
      continue;
    }

    const rostered = await tx.rosterSlot.findFirst({
      where: { leagueId, playerId },
      select: { id: true },
    });

    if (rostered) {
      await tx.leagueWaiverClaim.updateMany({
        where: { leagueId, playerId, status: "PENDING" },
        data: { status: "EXPIRED", processedAt: now },
      });
      await tx.leaguePlayerWaiver.deleteMany({
        where: { leagueId, playerId },
      });
      processedCount += 1;
      expiredCount += pendingClaims.length;
      continue;
    }

    const sortedClaims = [...pendingClaims].sort((a, b) => {
      const priorityA = priorityMap.get(a.fantasyTeamId) ?? 9999;
      const priorityB = priorityMap.get(b.fantasyTeamId) ?? 9999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let winningClaim: (typeof sortedClaims)[number] | null = null;
    let targetSlotId: string | null = null;

    for (const claim of sortedClaims) {
      const slots = await tx.rosterSlot.findMany({
        where: { fantasyTeamId: claim.fantasyTeamId },
        select: { id: true, slotNumber: true, playerId: true, isStarter: true },
      });

      if (claim.dropPlayerId) {
        const dropSlot = slots.find(
          (slot) => slot.playerId === claim.dropPlayerId,
        );
        if (!dropSlot) {
          continue;
        }
        let dropSlotIsStarter = dropSlot.isStarter;
        if (lockInfo?.isLocked && lockInfo.matchWeekId) {
          const lineupSlot = await tx.teamMatchWeekLineupSlot.findUnique({
            where: {
              fantasyTeamId_matchWeekId_rosterSlotId: {
                fantasyTeamId: claim.fantasyTeamId,
                matchWeekId: lockInfo.matchWeekId,
                rosterSlotId: dropSlot.id,
              },
            },
            select: { isStarter: true },
          });
          if (lineupSlot) {
            dropSlotIsStarter = lineupSlot.isStarter;
          }
        }
        if (dropSlotIsStarter && lockInfo?.isLocked) {
          continue;
        }
        winningClaim = claim;
        targetSlotId = dropSlot.id;
        break;
      }

      const emptySlot = slots.find((slot) => !slot.playerId);
      if (!emptySlot) {
        continue;
      }

      winningClaim = claim;
      targetSlotId = emptySlot.id;
      break;
    }

    if (!winningClaim || !targetSlotId) {
      await tx.leagueWaiverClaim.updateMany({
        where: { leagueId, playerId, status: "PENDING" },
        data: { status: "EXPIRED", processedAt: now },
      });
      await tx.leaguePlayerWaiver.deleteMany({
        where: { leagueId, playerId },
      });
      processedCount += 1;
      expiredCount += pendingClaims.length;
      continue;
    }

    await tx.rosterSlot.update({
      where: { id: targetSlotId },
      data: { playerId },
    });

    if (targetMatchWeeks.length > 0) {
      const rosterSlots = await tx.rosterSlot.findMany({
        where: { fantasyTeamId: winningClaim.fantasyTeamId },
        select: { id: true, slotNumber: true, playerId: true, isStarter: true },
      });

      for (const matchWeek of targetMatchWeeks) {
        const existingSlots = await tx.teamMatchWeekLineupSlot.findMany({
          where: {
            fantasyTeamId: winningClaim.fantasyTeamId,
            matchWeekId: matchWeek.id,
          },
          select: { rosterSlotId: true },
        });
        const existingSlotIds = new Set(
          existingSlots.map((slot) => slot.rosterSlotId),
        );
        const missingSlots = rosterSlots.filter(
          (slot) => !existingSlotIds.has(slot.id),
        );

        if (missingSlots.length > 0) {
          const seedStarterMap = await findSeedStarterMap(
            tx,
            winningClaim.fantasyTeamId,
            seasonId,
            matchWeek.number,
          );
          await tx.teamMatchWeekLineupSlot.createMany({
            data: missingSlots.map((slot) => ({
              fantasyTeamId: winningClaim.fantasyTeamId,
              matchWeekId: matchWeek.id,
              rosterSlotId: slot.id,
              slotNumber: slot.slotNumber,
              playerId: slot.playerId ?? null,
              isStarter: seedStarterMap?.get(slot.id) ?? slot.isStarter,
            })),
          });
        }

        await tx.teamMatchWeekLineupSlot.update({
          where: {
            fantasyTeamId_matchWeekId_rosterSlotId: {
              fantasyTeamId: winningClaim.fantasyTeamId,
              matchWeekId: matchWeek.id,
              rosterSlotId: targetSlotId,
            },
          },
          data: { playerId, isStarter: false },
        });
      }
    }

    await tx.leaguePlayerWaiver.deleteMany({
      where: { leagueId, playerId },
    });

    await tx.leagueWaiverClaim.update({
      where: { id: winningClaim.id },
      data: { status: "WON", processedAt: now },
    });

    await tx.leagueWaiverClaim.updateMany({
      where: {
        leagueId,
        playerId,
        status: "PENDING",
        id: { not: winningClaim.id },
      },
      data: { status: "LOST", processedAt: now },
    });

    priorityMap = await moveWaiverPriorityToBottom(
      tx,
      leagueId,
      winningClaim.fantasyTeamId,
    );

    processedCount += 1;
    winnerCount += 1;
  }

  return {
    processedCount,
    winnerCount,
    expiredCount,
  } satisfies LeagueWaiverProcessResult;
};

export const processLeagueWaivers = async (
  leagueId: string,
  now: Date,
): Promise<LeagueWaiverProcessSummary | null> => {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, seasonId: true },
  });

  if (!league) {
    return null;
  }

  const lockInfo = await getSeasonLockInfo(prisma, league.seasonId);

  const result = await prisma.$transaction((tx) =>
    processLeagueWaiversInTransaction(tx, leagueId, now, lockInfo, league.seasonId),
  );

  return { leagueId, result, lockInfo };
};

export const processAllLeaguesWaivers = async (now: Date) => {
  const eligibleLeagues = await prisma.leaguePlayerWaiver.findMany({
    where: { waiverAvailableAt: { lte: now } },
    select: { leagueId: true },
    distinct: ["leagueId"],
  });

  const results: LeagueWaiverProcessSummary[] = [];

  for (const league of eligibleLeagues) {
    const processed = await processLeagueWaivers(league.leagueId, now);
    if (processed) {
      results.push(processed);
    }
  }

  return {
    now,
    leaguesProcessed: results.length,
    results,
  };
};
