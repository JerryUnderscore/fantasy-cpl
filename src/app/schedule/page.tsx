import Link from "next/link";
import MatchScheduleList, {
  type ScheduleMatch,
} from "@/components/match-schedule";
import { getActiveSeason } from "@/lib/matchweek";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";
import EmptyState from "@/components/layout/empty-state";

export const runtime = "nodejs";

export default async function SchedulePage() {
  const season = await getActiveSeason();
  const matches = season
    ? await prisma.match.findMany({
        where: { seasonId: season.id },
        orderBy: { kickoffAt: "asc" },
        take: 20,
        select: {
          id: true,
          kickoffAt: true,
          status: true,
          homeClub: { select: { name: true, shortName: true, slug: true } },
          awayClub: { select: { name: true, shortName: true, slug: true } },
        },
      })
    : [];

  const scheduleMatches: ScheduleMatch[] = matches.map((match) => ({
    ...match,
    kickoffAt: match.kickoffAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <PageHeader
            title="Schedule"
            subtitle={`CPL schedule for the beta season ${season?.name ?? "—"}.`}
          />
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
        <SectionCard title="Upcoming matches">
          {scheduleMatches.length === 0 ? (
            <EmptyState
              title="No scheduled matches"
              description="Matches will appear here once the CPL schedule is published."
            />
          ) : (
            <MatchScheduleList matches={scheduleMatches} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
