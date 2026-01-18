import { prisma } from "@/lib/prisma";
import { H2HResultStatus } from "@prisma/client";

type Pairing = { homeTeamId: string; awayTeamId: string };

type Round = Pairing[];

type TeamRecord = {
  fantasyTeamId: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  playedFinalized: number;
};

export const generateRoundRobinSchedule = (teamIds: string[]): Round[] => {
  if (teamIds.length < 2) return [];

  const teams: Array<string | null> = [...teamIds];
  if (teams.length % 2 === 1) {
    teams.push(null);
  }

  const rounds = teams.length - 1;
  const half = teams.length / 2;
  const fixed = teams[0];
  let rotation = teams.slice(1);
  const schedule: Round[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const left = [fixed, ...rotation.slice(0, half - 1)];
    const right = rotation.slice(half - 1).reverse();
    const matchups: Pairing[] = [];

    for (let index = 0; index < half; index += 1) {
      const home = left[index];
      const away = right[index];
      if (!home || !away) {
        continue;
      }

      if (round % 2 === 0) {
        matchups.push({ homeTeamId: home, awayTeamId: away });
      } else {
        matchups.push({ homeTeamId: away, awayTeamId: home });
      }
    }

    schedule.push(matchups);
    rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
  }

  return schedule;
};

const initializeRecord = (fantasyTeamId: string): TeamRecord => ({
  fantasyTeamId,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  playedFinalized: 0,
});

export const computeLeagueTeamRecords = (
  fantasyTeamIds: string[],
  finalizedMatchups: Array<{
    homeTeamId: string;
    awayTeamId: string;
    homePoints: number;
    awayPoints: number;
  }>,
): TeamRecord[] => {
  const records = new Map(
    fantasyTeamIds.map((id) => [id, initializeRecord(id)]),
  );

  finalizedMatchups.forEach((matchup) => {
    const home = records.get(matchup.homeTeamId);
    const away = records.get(matchup.awayTeamId);
    if (!home || !away) return;

    home.pointsFor += matchup.homePoints;
    home.pointsAgainst += matchup.awayPoints;
    away.pointsFor += matchup.awayPoints;
    away.pointsAgainst += matchup.homePoints;
    home.playedFinalized += 1;
    away.playedFinalized += 1;

    if (matchup.homePoints > matchup.awayPoints) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.homePoints < matchup.awayPoints) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }
  });

  records.forEach((record) => {
    record.points = record.wins * 3 + record.draws;
  });

  return Array.from(records.values());
};

export const finalizeLeagueMatchupsForMatchWeek = async (
  leagueId: string,
  matchWeekId: string,
) => {
  const matchups = await prisma.leagueMatchup.findMany({
    where: { leagueId, matchWeekId },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });

  if (!matchups.length) {
    return { updated: 0 };
  }

  const teamIds = Array.from(
    new Set(matchups.flatMap((matchup) => [matchup.homeTeamId, matchup.awayTeamId])),
  );

  const scores = await prisma.teamMatchWeekScore.findMany({
    where: {
      matchWeekId,
      fantasyTeamId: { in: teamIds },
      status: "FINAL",
    },
    select: { fantasyTeamId: true, points: true },
  });

  const scoreMap = new Map(scores.map((score) => [score.fantasyTeamId, score.points]));

  await prisma.$transaction(
    matchups.map((matchup) => {
      const homePoints = scoreMap.get(matchup.homeTeamId) ?? 0;
      const awayPoints = scoreMap.get(matchup.awayTeamId) ?? 0;
      const winnerTeamId =
        homePoints === awayPoints
          ? null
          : homePoints > awayPoints
            ? matchup.homeTeamId
            : matchup.awayTeamId;

      return prisma.leagueMatchup.update({
        where: { id: matchup.id },
        data: {
          homePoints,
          awayPoints,
          winnerTeamId,
          resultStatus: H2HResultStatus.FINAL,
        },
      });
    }),
  );

  return { updated: matchups.length };
};

export const recomputeLeagueTeamRecords = async (leagueId: string) => {
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true },
  });

  const finalizedMatchups = await prisma.leagueMatchup.findMany({
    where: { leagueId, resultStatus: H2HResultStatus.FINAL },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homePoints: true,
      awayPoints: true,
    },
  });

  const records = computeLeagueTeamRecords(
    teams.map((team) => team.id),
    finalizedMatchups,
  );

  await prisma.$transaction(
    records.map((record) =>
      prisma.leagueTeamRecord.upsert({
        where: {
          leagueId_fantasyTeamId: {
            leagueId,
            fantasyTeamId: record.fantasyTeamId,
          },
        },
        create: {
          leagueId,
          fantasyTeamId: record.fantasyTeamId,
          wins: record.wins,
          draws: record.draws,
          losses: record.losses,
          points: record.points,
          pointsFor: record.pointsFor,
          pointsAgainst: record.pointsAgainst,
          playedFinalized: record.playedFinalized,
        },
        update: {
          wins: record.wins,
          draws: record.draws,
          losses: record.losses,
          points: record.points,
          pointsFor: record.pointsFor,
          pointsAgainst: record.pointsAgainst,
          playedFinalized: record.playedFinalized,
        },
      }),
    ),
  );

  return { updated: records.length };
};
