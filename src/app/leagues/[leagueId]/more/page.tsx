import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type Params = { leagueId: string };

type SearchParamsShape = { from?: string };

export default async function LeagueMorePage({
  params,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParamsShape>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      season: { select: { name: true, year: true } },
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
        pageTitle="More"
        pageSubtitle="Sign in to access league utilities."
      >
        <AuthButtons isAuthenticated={false} />
      </LeaguePageShell>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, isAdmin: true },
  });

  if (!profile) {
    return (
      <LeaguePageShell
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="More"
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
    where: { leagueId_profileId: { leagueId, profileId: profile.id } },
    select: { role: true },
  });

  if (!membership) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="More"
        pageSubtitle="Join this league to access league utilities."
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

  const isCommissioner = membership.role === "OWNER" || profile.isAdmin;

  const links = [
    { href: `/leagues/${leagueId}/trades`, label: "Trades" },
    { href: `/leagues/${leagueId}/schedule`, label: "Schedule" },
    { href: `/leagues/${leagueId}/stats`, label: "Stats" },
    { href: `/leagues/${leagueId}/rules`, label: "Rules" },
    { href: `/feedback`, label: "Feedback" },
    { href: `/privacy`, label: "Privacy" },
  ];

  if (isCommissioner) {
    links.push({ href: `/leagues/${leagueId}/settings`, label: "Admin" });
  }

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueId}`}
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle="More"
      pageSubtitle="League utilities and account shortcuts."
    >
      <div className="flex flex-col gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            <span>{link.label}</span>
            <span className="text-xs text-[var(--text-muted)]">→</span>
          </Link>
        ))}
      </div>
    </LeaguePageShell>
  );
}
