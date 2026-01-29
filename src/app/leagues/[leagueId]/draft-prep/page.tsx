import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function Page({
  params,
}: {
  params: Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, season: { select: { name: true, year: true } } },
  });

  if (!league) notFound();

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueId}`}
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle="Draft prep"
      pageSubtitle="Review the draft board inside the live draft view."
    >
      <p className="text-sm text-[var(--text-muted)]">
        Draft preparation happens inside the live draft view.
      </p>
      <Link
        href={`/leagues/${leagueId}/draft`}
        className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
      >
        Go to draft
      </Link>
    </LeaguePageShell>
  );
}
