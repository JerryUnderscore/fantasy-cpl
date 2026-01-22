export type MyLeagueViewModel = {
  league: { id: string; name: string; seasonLabel: string; inviteCode?: string };
  teamName?: string;
  standings?: { rank: number; totalTeams: number };
  statusText: string;
  role: "COMMISSIONER" | "MEMBER" | "OWNER" | string;
  isOwner: boolean;
};

export type OpenLeagueViewModel = {
  id: string;
  name: string;
  teamsCount: number;
};
