import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import TradesClient from "./trades-client";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function LeagueTradesPage({
  params,
}: {
  params: Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, season: true },
  });

  if (!league) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LeaguePageShell
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Trades"
        pageSubtitle="Sign in to view trade offers."
      >
          <AuthButtons isAuthenticated={false} />
      </LeaguePageShell>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <LeaguePageShell
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Trades"
        pageSubtitle="Please sync your profile from the home page and try again."
      >
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            Go to home
          </Link>
      </LeaguePageShell>
    );
  }

  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Trades"
        pageSubtitle="You need to join this league before viewing its trades."
      >
        <Link
          href="/leagues"
          className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
        >
          Browse leagues
        </Link>
      </LeaguePageShell>
    );
  }

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueId}`}
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle="Trades"
      pageSubtitle="Propose and review trades in this league."
      showBadgeTooltip={membership.role === "OWNER"}
    >
      <TradesClient leagueId={leagueId} />
    </LeaguePageShell>
  );
}
