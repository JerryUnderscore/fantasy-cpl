import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import LeaguesPageLayout from "@/components/leagues/leagues-page-layout";
import { loadLeaguesView } from "@/lib/leagues-view";

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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-[var(--text)]">
              Invite-only leagues
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Sign in to create or join your league.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            Back to home
          </Link>
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Profile not synced
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Please sync your profile from the home page and try again.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const view = await loadLeaguesView(profile.id);

  return <LeaguesPageLayout myLeagues={view.myLeagues} openLeagues={view.openLeagues} />;
}
