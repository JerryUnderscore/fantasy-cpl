import TeamContextHeader from "./team-context-header";
import LineupStatusCard from "./lineup-status-card";
import DeadlinesCard from "./deadlines-card";
import StandingsSnapshotCard from "./standings-snapshot-card";
import WaiverSignalsCard from "./waiver-signals-card";
import type { DashboardTeamViewModel } from "./types";

type TeamsDashboardPageProps = {
  viewModel: DashboardTeamViewModel;
  availableTeams: Array<{ id: string; name: string; leagueName: string }>;
  selectedTeamId: string;
};

export default function TeamsDashboardPage({
  viewModel,
  availableTeams,
  selectedTeamId,
}: TeamsDashboardPageProps) {
  const switcherOptions = availableTeams.map((team) => ({
    id: team.id,
    label: `${team.name} · ${team.leagueName}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <TeamContextHeader
        teamName={viewModel.team.name}
        leagueName={viewModel.league.name}
        seasonLabel={viewModel.league.seasonLabel}
        leagueId={viewModel.league.id}
        teamId={selectedTeamId}
        switcherOptions={availableTeams.length > 1 ? switcherOptions : undefined}
      />
      <div className="grid gap-6 md:grid-cols-[1.4fr_0.9fr]">
        <LineupStatusCard
          leagueId={viewModel.league.id}
          lineupStatus={viewModel.lineupStatus}
          upcomingMatchweek={viewModel.upcomingMatchweek}
        />
        <DeadlinesCard deadlines={viewModel.deadlines} />
      </div>
      <StandingsSnapshotCard standings={viewModel.standings} />
      <WaiverSignalsCard waivers={viewModel.waivers} leagueId={viewModel.league.id} />
    </div>
  );
}
