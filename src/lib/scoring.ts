import { PlayerMatchStat, PlayerPosition } from "@prisma/client";

type ScoreComponents = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
};

const GOAL_POINTS: Record<PlayerPosition, number> = {
  GK: 5,
  DEF: 5,
  MID: 4,
  FWD: 3,
};

export function scorePlayer(
  position: PlayerPosition,
  stat: PlayerMatchStat,
): { points: number; components: ScoreComponents } {
  const appearance = stat.minutes > 0 ? 1 : 0;
  const goals = stat.goals * GOAL_POINTS[position];
  const assists = stat.assists * 3;
  const cleanSheet =
    (position === "GK" || position === "DEF") &&
    stat.minutes >= 60 &&
    stat.cleanSheet
      ? 4
      : 0;
  const yellowCards = stat.yellowCards * -1;
  const redCards = stat.redCards * -3;
  const ownGoals = stat.ownGoals * -2;

  const components = {
    appearance,
    goals,
    assists,
    cleanSheet,
    yellowCards,
    redCards,
    ownGoals,
  };

  const points = Object.values(components).reduce(
    (total, value) => total + value,
    0,
  );

  return { points, components };
}
