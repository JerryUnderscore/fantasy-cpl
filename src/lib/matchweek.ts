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
 * returns the most recent MatchWeek that is OPEN or LOCKED.
 *
 * Example: MW1 FINALIZED, MW2 not created yet -> returns null.
 * Example: MW2 OPEN -> returns MW2.
 * Example: MW2 LOCKED -> returns MW2.
 */
export const getActiveMatchWeekForSeason = (seasonId: string) =>
  prisma.matchWeek.findFirst({
    where: {
      seasonId,
      status: { in: [MatchWeekStatus.OPEN, MatchWeekStatus.LOCKED] },
    },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      lockAt: true,
      finalizedAt: true,
    },
  });

/**
 * "Current" MatchWeek = the latest MatchWeek row that exists for the season,
 * regardless of status (OPEN / LOCKED / FINALIZED).
 *
 * Use this for lineup locking, because FINALIZED still must block edits
 * until a new MatchWeek is opened.
 *
 * Example: MW1 FINALIZED -> returns MW1.
 * Example: MW1 FINALIZED + MW2 OPEN -> returns MW2.
 */
export const getCurrentMatchWeekForSeason = (seasonId: string) =>
  prisma.matchWeek.findFirst({
    where: { seasonId },
    orderBy: { number: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      lockAt: true,
      finalizedAt: true,
    },
  });

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
