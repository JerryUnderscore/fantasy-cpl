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

  const groupedMatches = scheduleMatches.reduce(
    (acc, match) => {
      const kickoff = new Date(match.kickoffAt);
      const key = kickoff.toISOString().split("T")[0];
      const label = kickoff.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const entry = acc.find((group) => group.key === key);
      if (entry) {
        entry.matches.push(match);
      } else {
        acc.push({ key, label, matches: [match], date: kickoff });
      }
      return acc;
    },
    [] as Array<{
      key: string;
      label: string;
      date: Date;
      matches: ScheduleMatch[];
    }>,
  );

  groupedMatches.sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatTime = (kickoffAt: string) =>
    new Date(kickoffAt).toLocaleTimeString("en-US", {
      timeZone: "America/Toronto",
      hour: "numeric",
      minute: "2-digit",
    });

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
          <div className="sm:hidden">
            {scheduleMatches.length === 0 ? (
              <EmptyState
                title="No scheduled matches"
                description="Matches will appear here once the CPL schedule is published."
              />
            ) : (
              <div className="flex flex-col gap-6">
                {groupedMatches.map((group) => (
                  <section key={group.key} className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-3">
                      {group.matches.map((match) => {
                        const statusLabel =
                          match.status === "COMPLETED"
                            ? "Final"
                            : match.status === "POSTPONED"
                              ? "Postponed"
                              : match.status === "CANCELED"
                                ? "Canceled"
                                : "Scheduled";
                        const kickoffLabel =
                          match.status === "COMPLETED"
                            ? "Final"
                            : `${formatTime(match.kickoffAt)} ET`;
                        return (
                          <Link
                            key={match.id}
                            href={`/matches/${match.id}`}
                            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition hover:border-[var(--accent)]"
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[var(--text-muted)]">
                              <span>{kickoffLabel}</span>
                              <span>{statusLabel}</span>
                            </div>
                            <div className="flex flex-col gap-2 text-sm font-semibold text-[var(--text)]">
                              <div>{match.homeClub.name}</div>
                              <div>{match.awayClub.name}</div>
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                              View stats
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            {scheduleMatches.length === 0 ? (
              <EmptyState
                title="No scheduled matches"
                description="Matches will appear here once the CPL schedule is published."
              />
            ) : (
              <MatchScheduleList matches={scheduleMatches} />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
