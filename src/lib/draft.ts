import { DraftMode, DraftStatus, PlayerPosition, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRosterSlots } from "@/lib/roster";
import { validateRosterAddition } from "@/lib/roster";

type DraftTeam = {
  id: string;
  name: string;
  profileId: string;
  createdAt: Date;
};

type DraftPickLite = {
  pickNumber: number;
  fantasyTeamId: string;
};

export type DraftOnTheClock = {
  pickNumber: number;
  round: number;
  slotInRound: number;
  fantasyTeamId: string;
  fantasyTeamName: string;
};

export { buildRosterSlots };

const getSnakeTeamIndex = (
  round: number,
  slotInRound: number,
  teamCount: number,
) => (round % 2 === 1 ? slotInRound - 1 : teamCount - slotInRound);

export const computeCurrentPick = (
  teams: DraftTeam[],
  picks: DraftPickLite[],
  rounds: number,
): DraftOnTheClock | null => {
  const teamCount = teams.length;
  if (!teamCount || rounds <= 0) return null;
  const totalPicks = rounds * teamCount;
  const pickedNumbers = new Set(picks.map((pick) => pick.pickNumber));

  let nextPickNumber: number | null = null;
  for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber += 1) {
    if (!pickedNumbers.has(pickNumber)) {
      nextPickNumber = pickNumber;
      break;
    }
  }

  if (!nextPickNumber) return null;

  const round = Math.ceil(nextPickNumber / teamCount);
  const slotInRound = ((nextPickNumber - 1) % teamCount) + 1;
  const teamIndex = getSnakeTeamIndex(round, slotInRound, teamCount);
  const team = teams[teamIndex];
  if (!team) return null;

  return {
    pickNumber: nextPickNumber,
    round,
    slotInRound,
    fantasyTeamId: team.id,
    fantasyTeamName: team.name,
  };
};

export const computePickDeadline = ({
  draftStatus,
  draftMode,
  draftPickSeconds,
  currentPickStartedAt,
  draftCreatedAt,
  isPaused,
}: {
  draftStatus: DraftStatus;
  draftMode: DraftMode;
  draftPickSeconds: number | null;
  currentPickStartedAt: Date | null;
  draftCreatedAt: Date;
  isPaused?: boolean;
}) => {
  if (draftStatus !== "LIVE") return null;
  if (draftMode !== "LIVE") return null;
  if (isPaused) return null;
  if (typeof draftPickSeconds !== "number") return null;
  const startAt = currentPickStartedAt ?? draftCreatedAt;
  return new Date(startAt.getTime() + draftPickSeconds * 1000);
};

export const runDraftCatchUp = async ({
  leagueId,
  now: nowOverride,
}: {
  leagueId: string;
  now?: Date;
}) => {
  const now = nowOverride ?? new Date();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      seasonId: true,
      draftMode: true,
      draftPickSeconds: true,
      rosterSize: true,
      season: { select: { isActive: true } },
    },
  });

  if (!league || !league.season.isActive) {
    return { updated: false };
  }

  if (league.draftMode !== "LIVE") {
    return { updated: false };
  }

  if (
    typeof league.draftPickSeconds !== "number" ||
    !Number.isInteger(league.draftPickSeconds)
  ) {
    return { updated: false };
  }

    const draft = await prisma.draft.findUnique({
      where: { leagueId_seasonId: { leagueId, seasonId: league.seasonId } },
      select: {
        id: true,
        status: true,
        rounds: true,
        createdAt: true,
        currentPickStartedAt: true,
        isPaused: true,
      },
    });

  if (!draft || draft.status !== "LIVE") {
    return { updated: false };
  }
  if (draft.isPaused) {
    return { updated: false };
  }

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true, profileId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (!teams.length) {
    return { updated: false };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const txDraft = await tx.draft.findUnique({
          where: { id: draft.id },
          select: {
            id: true,
            status: true,
            rounds: true,
            createdAt: true,
            currentPickStartedAt: true,
            isPaused: true,
          },
        });

        if (!txDraft || txDraft.status !== "LIVE") {
          return { updated: false };
        }

        const txPicks = await tx.draftPick.findMany({
          where: { draftId: txDraft.id },
          select: { pickNumber: true, fantasyTeamId: true },
          orderBy: { pickNumber: "asc" },
        });

        const currentPick = computeCurrentPick(teams, txPicks, txDraft.rounds);
        const totalPicks = txDraft.rounds * teams.length;

        if (!currentPick) {
          if (txPicks.length >= totalPicks) {
            await tx.draft.update({
              where: { id: txDraft.id },
              data: { status: "COMPLETE", currentPickStartedAt: null },
            });
            return { updated: true };
          }
          return { updated: false };
        }

        const pickStartAt = txDraft.currentPickStartedAt ?? txDraft.createdAt;
        const deadline = computePickDeadline({
          draftStatus: txDraft.status,
          draftMode: league.draftMode,
          draftPickSeconds: league.draftPickSeconds,
          currentPickStartedAt: pickStartAt,
          draftCreatedAt: txDraft.createdAt,
          isPaused: txDraft.isPaused,
        });

        if (!deadline || now.getTime() <= deadline.getTime()) {
          return { updated: false };
        }

        const rosterPositions = await tx.rosterSlot.findMany({
          where: { fantasyTeamId: currentPick.fantasyTeamId, playerId: { not: null } },
          select: { player: { select: { position: true } } },
        });
        const currentPositions = rosterPositions
          .map((row) => row.player?.position)
          .filter((position): position is NonNullable<typeof position> =>
            Boolean(position),
          );
        const canAddPosition = (position: PlayerPosition) =>
          validateRosterAddition({
            rosterSize: league.rosterSize,
            currentPositions,
            addPosition: position,
          }).ok;

        const queuedItems = await tx.draftQueueItem.findMany({
          where: {
            draftId: txDraft.id,
            fantasyTeamId: currentPick.fantasyTeamId,
            player: {
              seasonId: league.seasonId,
              active: true,
              draftPicks: { none: { draftId: txDraft.id } },
            },
          },
          orderBy: { rank: "asc" },
          select: { playerId: true, player: { select: { position: true } } },
        });

        const queuedCandidate = queuedItems.find((item) =>
          item.player?.position ? canAddPosition(item.player.position) : false,
        );

        let fallbackPlayer: { id: string; position: PlayerPosition } | null = null;
        if (!queuedCandidate) {
          const fallbackPlayers = await tx.player.findMany({
            where: {
              seasonId: league.seasonId,
              active: true,
              draftPicks: { none: { draftId: txDraft.id } },
            },
            orderBy: { name: "asc" },
            select: { id: true, position: true },
            take: 200,
          });
          fallbackPlayer =
            fallbackPlayers.find((player) => canAddPosition(player.position)) ??
            null;
        }

        const playerId =
          queuedCandidate?.playerId ?? fallbackPlayer?.id ?? null;
        const playerPosition =
          queuedCandidate?.player?.position ?? fallbackPlayer?.position ?? null;

        if (!playerId || !playerPosition) {
          return { updated: false };
        }

        await tx.rosterSlot.createMany({
          data: buildRosterSlots(
            currentPick.fantasyTeamId,
            leagueId,
            league.rosterSize,
          ),
          skipDuplicates: true,
        });

        const openSlot = await tx.rosterSlot.findFirst({
          where: {
            fantasyTeamId: currentPick.fantasyTeamId,
            playerId: null,
          },
          orderBy: { slotNumber: "asc" },
          select: { id: true },
        });

        if (!openSlot) {
          return { updated: false };
        }

        const pickingTeam = teams.find(
          (team) => team.id === currentPick.fantasyTeamId,
        );

        if (!pickingTeam) {
          return { updated: false };
        }

        await tx.draftPick.create({
          data: {
            draftId: txDraft.id,
            pickNumber: currentPick.pickNumber,
            round: currentPick.round,
            slotInRound: currentPick.slotInRound,
            fantasyTeamId: currentPick.fantasyTeamId,
            profileId: pickingTeam.profileId,
            playerId,
          },
        });

        await tx.rosterSlot.update({
          where: { id: openSlot.id },
          data: { playerId, position: playerPosition },
        });

        await tx.draftQueueItem.deleteMany({
          where: {
            draftId: txDraft.id,
            fantasyTeamId: currentPick.fantasyTeamId,
            playerId,
          },
        });

        const nextStatus =
          currentPick.pickNumber >= totalPicks ? "COMPLETE" : "LIVE";

        const safeCommittedAt =
          txDraft.currentPickStartedAt &&
          txDraft.currentPickStartedAt.getTime() > now.getTime()
            ? txDraft.currentPickStartedAt
            : now;

        await tx.draft.update({
          where: { id: txDraft.id },
          data: {
            status: nextStatus,
            currentPickStartedAt: nextStatus === "COMPLETE" ? null : safeCommittedAt,
          },
        });

        return { updated: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { updated: false };
    }
    return { updated: false };
  }
};
