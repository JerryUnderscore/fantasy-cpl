import { PlayerPosition } from "@prisma/client";

export const ROSTER_LIMITS = {
  min: {
    GK: 0,
    DEF: 3,
    MID: 3,
    FWD: 1,
  },
  max: {
    GK: 1,
  },
};

export type RosterPositionCounts = Record<PlayerPosition, number>;

export const buildPositionCounts = (
  positions: PlayerPosition[],
): RosterPositionCounts =>
  positions.reduce(
    (acc, position) => {
      acc[position] += 1;
      return acc;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );

export const validateRosterAddition = ({
  rosterSize,
  currentPositions,
  addPosition,
  dropPosition,
}: {
  rosterSize: number;
  currentPositions: PlayerPosition[];
  addPosition: PlayerPosition;
  dropPosition?: PlayerPosition | null;
}) => {
  const safeRosterSize = Number.isFinite(rosterSize)
    ? Math.max(0, Math.floor(rosterSize))
    : 0;
  const counts = buildPositionCounts(currentPositions);
  if (dropPosition) {
    counts[dropPosition] = Math.max(0, counts[dropPosition] - 1);
  }

  const currentTotal = currentPositions.length - (dropPosition ? 1 : 0);
  const openSlots = safeRosterSize - currentTotal;
  if (openSlots <= 0) {
    return { ok: false, error: "Roster is full" };
  }

  const nextCounts = { ...counts, [addPosition]: counts[addPosition] + 1 };
  const maxGoalkeepers = ROSTER_LIMITS.max.GK ?? 1;
  if (nextCounts.GK > maxGoalkeepers) {
    return {
      ok: false,
      error: `Roster limit reached: you can only carry ${maxGoalkeepers} goalkeeper${maxGoalkeepers === 1 ? "" : "s"}.`,
    };
  }

  const remainingSlots = safeRosterSize - (currentTotal + 1);
  const minShortfall = (Object.keys(ROSTER_LIMITS.min) as PlayerPosition[]).some(
    (position) => {
      const minRequired = ROSTER_LIMITS.min[position] ?? 0;
      return nextCounts[position] + remainingSlots < minRequired;
    },
  );

  if (minShortfall) {
    const min = ROSTER_LIMITS.min;
    const requirementLabel = `at least ${min.DEF} defenders, ${min.MID} midfielders, and ${min.FWD} forward${min.FWD === 1 ? "" : "s"}`;
    return {
      ok: false,
      error: `Roster requirements not met. Your roster must include ${requirementLabel}.`,
    };
  }

  return { ok: true };
};

export const validateRosterComposition = ({
  rosterSize,
  positions,
}: {
  rosterSize: number;
  positions: PlayerPosition[];
}) => {
  const safeRosterSize = Number.isFinite(rosterSize)
    ? Math.max(0, Math.floor(rosterSize))
    : 0;
  const counts = buildPositionCounts(positions);

  if (positions.length > safeRosterSize) {
    return { ok: false, error: "Roster is full" };
  }

  const maxGoalkeepers = ROSTER_LIMITS.max.GK ?? 1;
  if (counts.GK > maxGoalkeepers) {
    return {
      ok: false,
      error: `Roster limit reached: you can only carry ${maxGoalkeepers} goalkeeper${maxGoalkeepers === 1 ? "" : "s"}.`,
    };
  }

  const remainingSlots = safeRosterSize - positions.length;
  const minShortfall = (Object.keys(ROSTER_LIMITS.min) as PlayerPosition[]).some(
    (position) => {
      const minRequired = ROSTER_LIMITS.min[position] ?? 0;
      return counts[position] + remainingSlots < minRequired;
    },
  );

  if (minShortfall) {
    const min = ROSTER_LIMITS.min;
    const requirementLabel = `at least ${min.DEF} defenders, ${min.MID} midfielders, and ${min.FWD} forward${min.FWD === 1 ? "" : "s"}`;
    return {
      ok: false,
      error: `Roster requirements not met. Your roster must include ${requirementLabel}.`,
    };
  }

  return { ok: true };
};

const DEFAULT_POSITION_LAYOUT: PlayerPosition[] = [
  PlayerPosition.GK,
  PlayerPosition.GK,
  PlayerPosition.DEF,
  PlayerPosition.DEF,
  PlayerPosition.DEF,
  PlayerPosition.DEF,
  PlayerPosition.DEF,
  PlayerPosition.MID,
  PlayerPosition.MID,
  PlayerPosition.MID,
  PlayerPosition.MID,
  PlayerPosition.MID,
  PlayerPosition.FWD,
  PlayerPosition.FWD,
  PlayerPosition.FWD,
];

const getRosterSlotPositions = (rosterSize: number) => {
  const size = Number.isFinite(rosterSize)
    ? Math.max(0, Math.floor(rosterSize))
    : 0;
  if (size <= DEFAULT_POSITION_LAYOUT.length) {
    return DEFAULT_POSITION_LAYOUT.slice(0, size);
  }

  const extra = size - DEFAULT_POSITION_LAYOUT.length;
  return [
    ...DEFAULT_POSITION_LAYOUT,
    ...Array.from({ length: extra }, () => PlayerPosition.MID),
  ];
};

export const buildRosterSlots = (
  fantasyTeamId: string,
  leagueId: string,
  rosterSize: number,
) =>
  getRosterSlotPositions(rosterSize).map((position, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position,
  }));
