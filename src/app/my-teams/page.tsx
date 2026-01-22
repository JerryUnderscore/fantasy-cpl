import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import TeamsDashboardPage from "@/components/teams-dashboard/teams-dashboard-page";
import TeamsCompactList from "@/components/teams-dashboard/teams-compact-list";
import {
  getTestDashboardViewModels,
  loadTeamDashboardViewModels,
} from "@/lib/team-dashboard";
import type {
  DashboardTeamViewModel,
  TeamsCompactRowModel,
} from "@/components/teams-dashboard/types";

export const runtime = "nodejs";

type SearchParams = {
  teamId?: string;
};

const renderDashboard = (
  viewModels: DashboardTeamViewModel[],
  requestedTeamId?: string,
) => {
  if (viewModels.length === 0) {
    return (
      <div className="flex flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold text-white">No teams yet</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Join or create a league to start managing your lineup and track deadlines.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/leagues"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--background)] shadow-sm transition hover:bg-[var(--accent-muted)]"
          >
            Join league
          </Link>
          <Link
            href="/leagues"
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Create league
          </Link>
        </div>
      </div>
    );
  }

  const availableTeams = viewModels.map((view) => ({
    id: view.team.id,
    name: view.team.name,
    leagueName: view.league.name,
  }));

  const selectedViewModel = viewModels.find((view) => view.team.id === requestedTeamId);
  const shouldShowCompactList = viewModels.length > 1 && !selectedViewModel;

  if (shouldShowCompactList) {
    const rows: TeamsCompactRowModel[] = viewModels.map((view) => ({
      id: view.team.id,
      name: view.team.name,
      leagueName: view.league.name,
      leagueId: view.league.id,
      rank: view.standings.rank,
      totalTeams: view.standings.totalTeams,
      lineupState: view.lineupStatus.state,
      upcomingDeadline: view.deadlines[0] ?? null,
    }));
    return <TeamsCompactList rows={rows} />;
  }

  const activeView = selectedViewModel ?? viewModels[0];

  return (
    <TeamsDashboardPage
      viewModel={activeView}
      availableTeams={availableTeams}
      selectedTeamId={activeView.team.id}
    />
  );
};

export default async function MyTeamsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedTeamId = params?.teamId;
  const testMode = process.env.NEXT_PUBLIC_MY_TEAMS_TEST_MODE === "1";

  if (testMode) {
    return renderDashboard(getTestDashboardViewModels(), requestedTeamId);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-[60vh] rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          My Teams
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Sign in to continue</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Connect your account to view and manage your fantasy teams.
        </p>
        <div className="mt-6 w-full max-w-md">
          <AuthButtons isAuthenticated={false} />
        </div>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-10 shadow-sm">
        <h1 className="text-3xl font-semibold text-[var(--accent)]">Profile not synced</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Please sync your profile from the home page before accessing your teams.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-muted)]"
        >
          Go to home page
        </Link>
      </div>
    );
  }

  const viewModels = await loadTeamDashboardViewModels(profile.id);

  return renderDashboard(viewModels, requestedTeamId);
}
