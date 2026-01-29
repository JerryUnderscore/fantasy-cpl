import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import PlayersClient from "./players-client";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function LeaguePlayersPage({
  params,
}: {
  params: Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      season: { select: { id: true, name: true, year: true } },
    },
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
        pageTitle="Players"
        pageSubtitle="Sign in to view league players."
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
        pageTitle="Players"
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
        pageTitle="Players"
        pageSubtitle="You need to join this league before viewing its players."
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
      pageTitle="Players"
      pageSubtitle="League player pool and availability."
      showBadgeTooltip={membership.role === "OWNER"}
    >
      <PlayersClient leagueId={league.id} />
    </LeaguePageShell>
  );
}
