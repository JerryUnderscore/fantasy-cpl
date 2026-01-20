import { prisma } from "@/lib/prisma";
import {
  PlayerMatchStat,
  PlayerPosition,
  ScoreSource,
  ScoreStatus,
} from "@prisma/client";
import { scorePlayer } from "@/lib/scoring";

type ScoreComponents = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
};

type PlayerScoreBreakdown = {
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  cleanSheet: boolean;
  components: ScoreComponents;
};

type PlayerInfo = {
  id: string;
  name: string;
  position: PlayerPosition;
  clubSlug: string | null;
};

type ComputedPlayerScore = {
  playerId: string;
  playerName: string;
  position: PlayerPosition;
  clubSlug: string | null;
  points: number;
  isStarter: boolean;
  source: ScoreSource;
  breakdown: PlayerScoreBreakdown;
};

type TeamScoreComputation = {
  totalPoints: number;
  startersCount: number;
  playerResults: ComputedPlayerScore[];
};

const buildEmptyStat = (
  playerId: string,
  matchWeekId: string,
): PlayerMatchStat => ({
  id: `missing-${playerId}-${matchWeekId}`,
  playerId,
  matchWeekId,
  minutes: 0,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  cleanSheet: false,
});

export function computePlayerPointsFromStats(
  player: { id: string; position: PlayerPosition },
  playerMatchStat: PlayerMatchStat,
): { points: number; breakdown: PlayerScoreBreakdown } {
  const scored = scorePlayer(player.position, playerMatchStat);

  return {
    points: scored.points,
    breakdown: {
      minutes: playerMatchStat.minutes,
      goals: playerMatchStat.goals,
      assists: playerMatchStat.assists,
      yellowCards: playerMatchStat.yellowCards,
      redCards: playerMatchStat.redCards,
      ownGoals: playerMatchStat.ownGoals,
      cleanSheet: playerMatchStat.cleanSheet,
      components: scored.components,
    },
  };
}

export async function computeTeamMatchWeekScore(
  fantasyTeamId: string,
  matchWeekId: string,
): Promise<TeamScoreComputation> {
  const [lineupSlots, rosterSlotCount] = await Promise.all([
    prisma.teamMatchWeekLineupSlot.findMany({
      where: { fantasyTeamId, matchWeekId },
      select: {
        playerId: true,
        isStarter: true,
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            club: { select: { slug: true } },
          },
        },
      },
    }),
    prisma.rosterSlot.count({ where: { fantasyTeamId } }),
  ]);

  const hasFullLineup =
    rosterSlotCount > 0 && lineupSlots.length >= rosterSlotCount;

  const starters =
    hasFullLineup
      ? lineupSlots.filter((slot) => slot.isStarter && slot.playerId)
      : await prisma.rosterSlot.findMany({
          where: {
            fantasyTeamId,
            isStarter: true,
            playerId: { not: null },
          },
          select: {
            playerId: true,
            player: {
              select: {
                id: true,
                name: true,
                position: true,
                club: { select: { slug: true } },
              },
            },
          },
        });

  const players: PlayerInfo[] = starters.flatMap((slot) => {
    if (!slot.player || !slot.playerId) return [];
    return [
      {
        id: slot.player.id,
        name: slot.player.name,
        position: slot.player.position,
        clubSlug: slot.player.club?.slug ?? null,
      },
    ];
  });

  const playerIds = players.map((player) => player.id);

  const stats = playerIds.length
    ? await prisma.playerMatchStat.findMany({
        where: {
          matchWeekId,
          playerId: { in: playerIds },
        },
      })
    : [];

  const statsByPlayer = new Map(stats.map((stat) => [stat.playerId, stat]));

  const playerResults = players.map((player) => {
    const stat =
      statsByPlayer.get(player.id) ??
      buildEmptyStat(player.id, matchWeekId);
    const { points, breakdown } = computePlayerPointsFromStats(player, stat);

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      clubSlug: player.clubSlug,
      points,
      isStarter: true,
      source: ScoreSource.STARTER,
      breakdown,
    };
  });

  const totalPoints = playerResults.reduce(
    (sum, entry) => sum + entry.points,
    0,
  );

  return {
    totalPoints,
    startersCount: playerResults.length,
    playerResults,
  };
}

export async function persistTeamMatchWeekScore(
  fantasyTeamId: string,
  matchWeekId: string,
  options?: { status?: ScoreStatus },
): Promise<{
  created: boolean;
  points: number;
  playerScoresCount: number;
}> {
  const computation = await computeTeamMatchWeekScore(
    fantasyTeamId,
    matchWeekId,
  );
  const status = options?.status ?? ScoreStatus.PROVISIONAL;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.teamMatchWeekScore.findUnique({
      where: {
        fantasyTeamId_matchWeekId: {
          fantasyTeamId,
          matchWeekId,
        },
      },
      select: { id: true },
    });

    await tx.teamMatchWeekScore.upsert({
      where: {
        fantasyTeamId_matchWeekId: {
          fantasyTeamId,
          matchWeekId,
        },
      },
      create: {
        fantasyTeamId,
        matchWeekId,
        points: computation.totalPoints,
        status,
        computedAt: new Date(),
      },
      update: {
        points: computation.totalPoints,
        status,
        computedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.teamMatchWeekPlayerScore.deleteMany({
      where: { fantasyTeamId, matchWeekId },
    });

    if (computation.playerResults.length) {
      await tx.teamMatchWeekPlayerScore.createMany({
        data: computation.playerResults.map((result) => ({
          fantasyTeamId,
          matchWeekId,
          playerId: result.playerId,
          points: result.points,
          isStarter: result.isStarter,
          source: result.source,
          breakdown: result.breakdown,
        })),
      });
    }

    return {
      created: !existing,
      points: computation.totalPoints,
      playerScoresCount: computation.playerResults.length,
    };
  });
}

export const buildScoreComponents = (value: unknown): ScoreComponents => {
  if (!value || typeof value !== "object") {
    return {
      appearance: 0,
      goals: 0,
      assists: 0,
      cleanSheet: 0,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
    };
  }

  const record = value as Record<string, unknown>;
  const toNumber = (input: unknown) =>
    Number.isFinite(Number(input)) ? Number(input) : 0;

  return {
    appearance: toNumber(record.appearance),
    goals: toNumber(record.goals),
    assists: toNumber(record.assists),
    cleanSheet: toNumber(record.cleanSheet),
    yellowCards: toNumber(record.yellowCards),
    redCards: toNumber(record.redCards),
    ownGoals: toNumber(record.ownGoals),
  };
};

export const buildScoreBreakdown = (value: unknown): PlayerScoreBreakdown => {
  if (!value || typeof value !== "object") {
    return {
      minutes: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      cleanSheet: false,
      components: buildScoreComponents(null),
    };
  }

  const record = value as Record<string, unknown>;
  const toNumber = (input: unknown) =>
    Number.isFinite(Number(input)) ? Number(input) : 0;

  return {
    minutes: toNumber(record.minutes),
    goals: toNumber(record.goals),
    assists: toNumber(record.assists),
    yellowCards: toNumber(record.yellowCards),
    redCards: toNumber(record.redCards),
    ownGoals: toNumber(record.ownGoals),
    cleanSheet: Boolean(record.cleanSheet),
    components: buildScoreComponents(record.components),
  };
};
