export type LineupStatusState =
  | "SET"
  | "MISSING_SLOTS"
  | "NON_STARTERS"
  | "NOT_OPEN";

export type DeadlineItem = {
  label: string;
  at: string | null;
  relativeText: string;
};

export type StandingsSnapshot = {
  rank: number;
  totalTeams: number;
  points: number;
  deltaRank?: number;
  deltaPoints?: number;
};

export type WaiverSignal = {
  summaryText: string;
  hasOpportunities: boolean;
};

export type UpcomingMatchweekInfo = {
  id: string;
  label: string;
  lockAt: string | null;
};

export type DashboardTeamViewModel = {
  team: { id: string; name: string };
  league: { id: string; name: string; seasonLabel: string };
  upcomingMatchweek: UpcomingMatchweekInfo;
  lineupStatus: {
    state: LineupStatusState;
    missingSlots?: number;
    nonStarters?: number;
  };
  stakes: {
    hasAction: boolean;
  };
  standings: StandingsSnapshot;
  deadlines: DeadlineItem[];
  waivers: WaiverSignal;
};

export type TeamsCompactRowModel = {
  id: string;
  name: string;
  leagueName: string;
  leagueId: string;
  rank: number;
  totalTeams: number;
  lineupState: LineupStatusState;
  upcomingDeadline: DeadlineItem | null;
};
