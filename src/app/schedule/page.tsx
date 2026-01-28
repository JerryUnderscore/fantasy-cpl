import Link from "next/link";
import MatchScheduleList, {
  type ScheduleMatch,
} from "@/components/match-schedule";
import { getActiveSeason } from "@/lib/matchweek";
import { prisma } from "@/lib/prisma";

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_25px_45px_rgba(1,2,12,0.55)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold text-[var(--text)]">Schedule</h1>
            <Link
              href="/"
              className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] hover:underline"
            >
              Back to dashboard
            </Link>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            CPL schedule for the beta season {season?.name ?? "—"}.
          </p>
        </div>
        {scheduleMatches.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No scheduled matches yet.
          </p>
        ) : (
          <div className="mt-3">
            <MatchScheduleList matches={scheduleMatches} />
          </div>
        )}
      </div>
    </div>
  );
}
