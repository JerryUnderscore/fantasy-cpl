import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeaguePageHeader from "@/components/leagues/league-page-header";
import PageHeader from "@/components/layout/page-header";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function ScoringAdminPage({
  params,
}: {
  params: Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });

  if (!league) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
          <LeaguePageHeader
            title={league.name}
            leagueName="Scoring administration"
          />
          <PageHeader
            title="Scoring admin"
            subtitle="Open the global scoring tool to manage matchweek stats."
          />
        </div>
        <p className="text-sm text-zinc-600">
          Scoring administration lives in the global scoring tool.
        </p>
        <Link
          href="/scoring-admin"
          className="w-fit rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:border-zinc-300 hover:text-black"
        >
          Open scoring admin
        </Link>
      </div>
    </div>
  );
}
