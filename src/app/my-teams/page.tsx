import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import TeamsDashboardPage from "@/components/teams-dashboard/teams-dashboard-page";
import TeamsCompactList from "@/components/teams-dashboard/teams-compact-list";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/layout/empty-state";
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
      <EmptyState
        title="No teams yet"
        description="Join a league to create your first team, or create a league and invite friends."
        primaryAction={
          <Link
            href="/leagues"
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-muted)]"
          >
            Join league
          </Link>
        }
        secondaryLink={
          <Link
            href="/leagues/create"
            className="rounded-full border border-[var(--border)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Create league
          </Link>
        }
      />
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
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedTeamId = params?.teamId;
  const testMode = process.env.NEXT_PUBLIC_MY_TEAMS_TEST_MODE === "1";

  if (testMode) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My teams"
          subtitle="Manage your teams and matchweek deadlines."
        />
        {renderDashboard(getTestDashboardViewModels(), requestedTeamId)}
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My teams"
          subtitle="Manage your teams and matchweek deadlines."
        />
        <EmptyState
          title="Sign in to continue"
          description="Connect your account to view and manage your fantasy teams."
          primaryAction={<AuthButtons isAuthenticated={false} />}
        />
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My teams"
          subtitle="Manage your teams and matchweek deadlines."
        />
        <EmptyState
          title="Profile not synced"
          description="Please sync your profile from the home page before accessing your teams."
          secondaryLink={
            <Link
              href="/"
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              Go to home page
            </Link>
          }
        />
      </div>
    );
  }

  const viewModels = await loadTeamDashboardViewModels(profile.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My teams"
        subtitle="Manage your teams and matchweek deadlines."
      />
      {renderDashboard(viewModels, requestedTeamId)}
    </div>
  );
}
