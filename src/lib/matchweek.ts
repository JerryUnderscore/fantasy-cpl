import { prisma } from "@/lib/prisma";
import { MatchWeekStatus } from "@prisma/client";

/**
 * Active season = the season currently used by the app (isActive = true).
 */
export const getActiveSeason = () =>
  prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true },
  });

/**
 * "Active" MatchWeek for gameplay flows that care about the in-progress week:
 * returns the lowest-number MatchWeek that is OPEN, or the lowest LOCKED if none OPEN.
 */
export const getActiveMatchWeekForSeason = async (seasonId: string) => {
  const select = {
    id: true,
    number: true,
    status: true,
    lockAt: true,
    finalizedAt: true,
  } as const;

  const openMatchWeek = await prisma.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.OPEN },
    orderBy: { number: "asc" },
    select,
  });

  if (openMatchWeek) {
    return openMatchWeek;
  }

  return prisma.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.LOCKED },
    orderBy: { number: "asc" },
    select,
  });
};

/**
 * "Current" MatchWeek = the lowest-number MatchWeek that is OPEN,
 * or the lowest LOCKED if none OPEN.
 */
export const getCurrentMatchWeekForSeason = async (seasonId: string) => {
  const select = {
    id: true,
    number: true,
    status: true,
    lockAt: true,
    finalizedAt: true,
  } as const;

  const openMatchWeek = await prisma.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.OPEN },
    orderBy: { number: "asc" },
    select,
  });

  if (openMatchWeek) {
    return openMatchWeek;
  }

  return prisma.matchWeek.findFirst({
    where: { seasonId, status: MatchWeekStatus.LOCKED },
    orderBy: { number: "asc" },
    select,
  });
};

export const getActiveMatchWeek = async () => {
  const season = await getActiveSeason();
  if (!season) return null;
  return getActiveMatchWeekForSeason(season.id);
};

export const getCurrentMatchWeek = async () => {
  const season = await getActiveSeason();
  if (!season) return null;
  return getCurrentMatchWeekForSeason(season.id);
};

type HeaderMatchweekInfo = {
  currentMatchWeekStatus: string | null;
  lineupLockAt: Date | null;
  nextMatchweekStartsAt: Date | null;
};

export const getHeaderMatchweekInfo = async (): Promise<HeaderMatchweekInfo> => {
  const activeSeason = await getActiveSeason();
  if (!activeSeason) {
    return {
      currentMatchWeekStatus: null,
      lineupLockAt: null,
      nextMatchweekStartsAt: null,
    };
  }

  const currentMatchWeek = await getCurrentMatchWeekForSeason(activeSeason.id);
  if (!currentMatchWeek) {
    return {
      currentMatchWeekStatus: null,
      lineupLockAt: null,
      nextMatchweekStartsAt: null,
    };
  }

  const earliestCurrentKickoff = await prisma.match.findFirst({
    where: { matchWeekId: currentMatchWeek.id },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });

  const nextMatchWeek = await prisma.matchWeek.findFirst({
    where: {
      seasonId: activeSeason.id,
      number: { gt: currentMatchWeek.number },
    },
    orderBy: { number: "asc" },
    select: { id: true, lockAt: true },
  });

  let nextMatchweekStartsAt: Date | null = null;
  if (nextMatchWeek) {
    const earliestNextKickoff = await prisma.match.findFirst({
      where: { matchWeekId: nextMatchWeek.id },
      orderBy: { kickoffAt: "asc" },
      select: { kickoffAt: true },
    });
    nextMatchweekStartsAt =
      earliestNextKickoff?.kickoffAt ?? nextMatchWeek.lockAt ?? null;
  }

  return {
    currentMatchWeekStatus: currentMatchWeek.status ?? null,
    lineupLockAt:
      earliestCurrentKickoff?.kickoffAt ?? currentMatchWeek.lockAt ?? null,
    nextMatchweekStartsAt,
  };
};

export const recalculateMatchWeekLockAt = async (matchWeekIds: string[]) => {
  const uniqueIds = Array.from(new Set(matchWeekIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return { updatedCount: 0 };
  }

  const matchWeeks = await prisma.matchWeek.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, status: true },
  });

  const eligibleMatchWeekIds = matchWeeks
    .filter((matchWeek) => matchWeek.status !== MatchWeekStatus.FINALIZED)
    .map((matchWeek) => matchWeek.id);

  if (eligibleMatchWeekIds.length === 0) {
    return { updatedCount: 0 };
  }

  const earliestKickoffs = await prisma.match.groupBy({
    by: ["matchWeekId"],
    where: { matchWeekId: { in: eligibleMatchWeekIds } },
    _min: { kickoffAt: true },
  });

  const kickoffMap = new Map(
    earliestKickoffs.map((row) => [row.matchWeekId, row._min.kickoffAt]),
  );

  await prisma.$transaction(
    eligibleMatchWeekIds.map((matchWeekId) =>
      prisma.matchWeek.update({
        where: { id: matchWeekId },
        data: { lockAt: kickoffMap.get(matchWeekId) ?? null },
      }),
    ),
  );

  return { updatedCount: eligibleMatchWeekIds.length };
};
