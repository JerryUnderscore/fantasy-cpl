import {
  POSITION_KEYS,
  POSITION_LABELS,
  type PositionKey,
} from "@/lib/lineup-positions";

export type LandingLineupGroup = "STARTER" | "BENCH";

export type LandingLineupSlotDef = {
  slotKey: string;
  label: string;
  group: LandingLineupGroup;
  position: PositionKey | null;
  order: number;
};

export const DEFAULT_LANDING_STARTERS: Array<{
  key: PositionKey;
  players: string[];
}> = [
  { key: "FWD", players: ["Tiago Coimbra", "Tobias Warschewski"] },
  {
    key: "MID",
    players: ["Manny Aparicio", "Kyle Bekker", "Ollie Bassett", "Sean Rea"],
  },
  {
    key: "DEF",
    players: [
      "Daniel Nimick",
      "Thomas Meilleur-Giguère",
      "Daan Klomp",
      "Noah Abatneh",
    ],
  },
  { key: "GK", players: ["Nathan Ingham"] },
];

export const DEFAULT_LANDING_BENCH = [
  "Marco Bustos",
  "David Norman Jr.",
  "Julian Altobelli",
  "David Choinière",
];

export const DEFAULT_LANDING_PLAYER_NAMES = [
  ...DEFAULT_LANDING_STARTERS.flatMap((group) => group.players),
  ...DEFAULT_LANDING_BENCH,
];

const STARTER_SLOT_COUNTS: Record<PositionKey, number> = {
  FWD: 2,
  MID: 4,
  DEF: 4,
  GK: 1,
};

const BENCH_SLOT_COUNT = 4;

export const LANDING_LINEUP_SLOT_DEFS: LandingLineupSlotDef[] = [
  ...POSITION_KEYS.flatMap((position) =>
    Array.from({ length: STARTER_SLOT_COUNTS[position] }, (_, index) => ({
      slotKey: `${position}-${index + 1}`,
      label: `${POSITION_LABELS[position]} ${index + 1}`,
      group: "STARTER" as const,
      position,
      order: index,
    })),
  ),
  ...Array.from({ length: BENCH_SLOT_COUNT }, (_, index) => ({
    slotKey: `BENCH-${index + 1}`,
    label: `Bench ${index + 1}`,
    group: "BENCH" as const,
    position: null,
    order: index,
  })),
];

const buildDefaultSlotAssignments = () => {
  const assignments: Record<string, string> = {};

  DEFAULT_LANDING_STARTERS.forEach((group) => {
    group.players.forEach((name, index) => {
      assignments[`${group.key}-${index + 1}`] = name;
    });
  });

  DEFAULT_LANDING_BENCH.forEach((name, index) => {
    assignments[`BENCH-${index + 1}`] = name;
  });

  return assignments;
};

export const DEFAULT_LANDING_SLOT_ASSIGNMENTS = buildDefaultSlotAssignments();

export const STARTER_SLOT_COUNTS_BY_POSITION = STARTER_SLOT_COUNTS;
export const BENCH_SLOT_TOTAL = BENCH_SLOT_COUNT;
