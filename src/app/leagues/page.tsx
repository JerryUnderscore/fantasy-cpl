import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import LeaguesPageLayout from "@/components/leagues/leagues-page-layout";
import { getTestLeaguesView, loadLeaguesView } from "@/lib/leagues-view";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/layout/empty-state";

export const runtime = "nodejs";

export default async function LeaguesPage() {
  const testMode = process.env.NEXT_PUBLIC_LEAGUES_TEST_MODE === "1";
  if (testMode) {
    const testView = getTestLeaguesView();
    return (
      <LeaguesPageLayout
        myLeagues={testView.myLeagues}
        openLeagues={testView.openLeagues}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <PageHeader
            title="Leagues"
            subtitle="Sign in to create or join your league."
          />
          <EmptyState
            title="Invite-only leagues"
            description="Create a league or join with an invite code."
            primaryAction={<AuthButtons isAuthenticated={false} />}
            secondaryLink={
              <Link
                href="/"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                Back to home
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <PageHeader
            title="Leagues"
            subtitle="Sign in to create or join your league."
          />
          <EmptyState
            title="Profile not synced"
            description="Please sync your profile from the home page and try again."
            secondaryLink={
              <Link
                href="/"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                Go to home
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const view = await loadLeaguesView(profile.id);

  return <LeaguesPageLayout myLeagues={view.myLeagues} openLeagues={view.openLeagues} />;
}
