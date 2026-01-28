import { MatchWeekStatus, WaiverClaimStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DashboardTeamViewModel,
  DeadlineItem,
  LineupStatusState,
} from "@/components/teams-dashboard/types";

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

const REQUIRED_STARTERS = 11;

const formatRelativeText = (target: Date | null, now: Date) => {
  if (!target) return "TBD";
  const diffMs = target.getTime() - now.getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (Math.abs(diffMs) < minute) return "moments";
  if (Math.abs(diffMs) < hour)
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / minute), "minute");
  if (Math.abs(diffMs) < day)
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / hour), "hour");

  return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / day), "day");
};

const evaluateLineupState = (
  slots: Array<{ isStarter: boolean; playerId: string | null }>,
  hasMatchweek: boolean,
) => {
  const starterCount = slots.filter((slot) => slot.isStarter && slot.playerId).length;
  const benchCount = slots.filter((slot) => !slot.isStarter && slot.playerId).length;
  const missingSlots = Math.max(0, REQUIRED_STARTERS - starterCount);

  let state: LineupStatusState;
  if (!hasMatchweek) {
    state = "NOT_OPEN";
  } else if (missingSlots > 0) {
    state = "MISSING_SLOTS";
  } else if (benchCount > 0) {
    state = "NON_STARTERS";
  } else {
    state = "SET";
  }

  return { state, missingSlots, benchCount };
};

const buildDeadlines = (
  league: {
    waiverPeriodHours: number;
    draftScheduledAt: Date | null;
  },
  upcomingMatchweek: { id: string; lockAt: Date | null } | null,
  now: Date,
): DeadlineItem[] => {
  const lockAt = upcomingMatchweek?.lockAt ?? null;
  const waiverAt = lockAt
    ? new Date(lockAt.getTime() - league.waiverPeriodHours * 60 * 60 * 1000)
    : null;
  const draftAt = league.draftScheduledAt ?? null;

  const deadlines: DeadlineItem[] = [
    {
      label: "Lineup lock",
      at: lockAt ? lockAt.toISOString() : null,
      relativeText: formatRelativeText(lockAt, now),
    },
    {
      label: "Waiver processing",
      at: waiverAt ? waiverAt.toISOString() : null,
      relativeText: formatRelativeText(waiverAt, now),
    },
  ];

  if (draftAt) {
    deadlines.push({
      label: "Draft window",
      at: draftAt.toISOString(),
      relativeText: formatRelativeText(draftAt, now),
    });
  }

  return deadlines.sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
};

const buildWaiverSignal = async (
  leagueId: string,
  fantasyTeamId: string,
  now: Date,
): Promise<{ summaryText: string; hasOpportunities: boolean }> => {
  const [pendingClaims, priority, nextWaiver] = await Promise.all([
    prisma.leagueWaiverClaim.count({
      where: {
        leagueId,
        fantasyTeamId,
        status: WaiverClaimStatus.PENDING,
      },
    }),
    prisma.leagueWaiverPriority.findFirst({
      where: { leagueId, fantasyTeamId },
      select: { priority: true },
    }),
    prisma.leaguePlayerWaiver.findFirst({
      where: { leagueId, waiverAvailableAt: { gte: now } },
      orderBy: { waiverAvailableAt: "asc" },
      select: { waiverAvailableAt: true },
    }),
  ]);

  const opportunity = pendingClaims > 0 || Boolean(nextWaiver);
  let summaryText = "Waiver priority pending.";

  if (pendingClaims > 0) {
    summaryText = `You have ${pendingClaims} pending waiver claim${
      pendingClaims === 1 ? "" : "s"
    }.`;
  } else if (nextWaiver?.waiverAvailableAt) {
    summaryText = `Next waiver batch opens ${formatRelativeText(
      new Date(nextWaiver.waiverAvailableAt),
      now,
    )}.`;
  } else if (priority) {
    summaryText = `Waiver priority ${priority.priority}. No action needed.`;
  }

  return {
    summaryText,
    hasOpportunities: opportunity,
  };
};

export async function loadTeamDashboardViewModels(
  profileId: string,
): Promise<DashboardTeamViewModel[]> {
  const teams = await prisma.fantasyTeam.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      leagueId: true,
      league: {
        select: {
          id: true,
          name: true,
          teamCount: true,
          waiverPeriodHours: true,
          draftScheduledAt: true,
          season: { select: { id: true, year: true, name: true } },
        },
      },
    },
  });

  const now = new Date();
  const viewModels: DashboardTeamViewModel[] = [];
  const matchweekCache = new Map<
    string,
    { id: string; number: number; name: string | null; lockAt: Date | null } | null
  >();

  for (const team of teams) {
    let upcomingMatchweek = matchweekCache.get(team.league.season.id);
    if (upcomingMatchweek === undefined) {
      upcomingMatchweek = await prisma.matchWeek.findFirst({
        where: {
          seasonId: team.league.season.id,
          status: { in: [MatchWeekStatus.OPEN, MatchWeekStatus.LOCKED] },
        },
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true, lockAt: true },
      });
      matchweekCache.set(team.league.season.id, upcomingMatchweek ?? null);
    }

    const lineupSlots = upcomingMatchweek
      ? await prisma.teamMatchWeekLineupSlot.findMany({
          where: { fantasyTeamId: team.id, matchWeekId: upcomingMatchweek.id },
          select: { isStarter: true, playerId: true },
        })
      : [];

    const { state, missingSlots, benchCount } = evaluateLineupState(
      lineupSlots,
      Boolean(upcomingMatchweek),
    );

    const standings = await prisma.leagueTeamRecord.findMany({
      where: { leagueId: team.leagueId },
      orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
      select: { fantasyTeamId: true, points: true },
    });

    const rankIndex = standings.findIndex(
      (record) => record.fantasyTeamId === team.id,
    );
    const rank =
      rankIndex === -1 ? standings.length + 1 : Math.min(rankIndex + 1, standings.length);
    const teamRecord = standings.find((record) => record.fantasyTeamId === team.id);
    const totalTeams = Math.max(team.league.teamCount ?? standings.length ?? 1, 1);

    const scoreHistory = await prisma.teamMatchWeekScore.findMany({
      where: { fantasyTeamId: team.id },
      orderBy: { matchWeek: { number: "desc" } },
      select: { points: true },
      take: 2,
    });

    const deltaPoints =
      scoreHistory.length >= 2 ? scoreHistory[0].points - scoreHistory[1].points : undefined;

    const deadlines = buildDeadlines(
      {
        waiverPeriodHours: team.league.waiverPeriodHours,
        draftScheduledAt: team.league.draftScheduledAt,
      },
      upcomingMatchweek
        ? {
            id: upcomingMatchweek.id,
            lockAt: upcomingMatchweek.lockAt,
          }
        : null,
      now,
    );

    const waiverSignal = await buildWaiverSignal(team.league.id, team.id, now);

    viewModels.push({
      team: { id: team.id, name: team.name },
      league: {
        id: team.league.id,
        name: team.league.name,
        seasonLabel: team.league.season.name
          ? `${team.league.season.year} · ${team.league.season.name}`
          : `${team.league.season.year} Season`,
      },
      upcomingMatchweek: {
        id: upcomingMatchweek?.id ?? team.id,
        label:
          upcomingMatchweek?.name ??
          (upcomingMatchweek?.number
            ? `Matchweek ${upcomingMatchweek.number}`
            : "Matchweek TBD"),
        lockAt: upcomingMatchweek?.lockAt?.toISOString() ?? null,
      },
      lineupStatus: {
        state,
        missingSlots,
        nonStarters: benchCount,
      },
      stakes: {
        hasAction: state !== "SET",
      },
      standings: {
        rank,
        totalTeams,
        points: teamRecord?.points ?? 0,
        deltaPoints,
      },
      deadlines,
      waivers: {
        summaryText: waiverSignal.summaryText,
        hasOpportunities: waiverSignal.hasOpportunities,
      },
    });
  }

  return viewModels;
}

const TEST_TEAM_DASHBOARD_VIEWMODELS: DashboardTeamViewModel[] = [
  {
    team: { id: "test-team-1", name: "Test Strikers" },
    league: {
      id: "test-league-1",
      name: "Midwinter Cup",
      seasonLabel: "2025 · Spring",
    },
    upcomingMatchweek: {
      id: "mw-05",
      label: "Matchweek 5",
      lockAt: "2025-04-12T18:00:00Z",
    },
    lineupStatus: {
      state: "MISSING_SLOTS",
      missingSlots: 2,
      nonStarters: 1,
    },
    stakes: { hasAction: true },
    standings: {
      rank: 2,
      totalTeams: 6,
      points: 22,
      deltaPoints: -1,
    },
    deadlines: [
      {
        label: "Lineup lock",
        at: "2025-04-12T18:00:00Z",
        relativeText: "in 5 days",
      },
      {
        label: "Waiver processing",
        at: "2025-04-10T15:00:00Z",
        relativeText: "in 4 days",
      },
    ],
    waivers: {
      summaryText: "Priority 1 waivers close soon for your missing starters.",
      hasOpportunities: true,
    },
  },
  {
    team: { id: "test-team-2", name: "League Leaders" },
    league: {
      id: "test-league-2",
      name: "Community Cup",
      seasonLabel: "2025 · Spring",
    },
    upcomingMatchweek: {
      id: "mw-05",
      label: "Matchweek 5",
      lockAt: "2025-04-12T18:00:00Z",
    },
    lineupStatus: {
      state: "SET",
      missingSlots: 0,
      nonStarters: 0,
    },
    stakes: { hasAction: false },
    standings: {
      rank: 1,
      totalTeams: 8,
      points: 34,
      deltaPoints: 5,
    },
    deadlines: [
      {
        label: "Lineup lock",
        at: "2025-04-12T18:00:00Z",
        relativeText: "in 5 days",
      },
    ],
    waivers: {
      summaryText: "No urgent waiver needs. You’re leading the charge.",
      hasOpportunities: false,
    },
  },
];

export function getTestDashboardViewModels(): DashboardTeamViewModel[] {
  return TEST_TEAM_DASHBOARD_VIEWMODELS;
}
