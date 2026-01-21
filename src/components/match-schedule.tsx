"use client";

import { useCallback, useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { MatchStatus } from "@prisma/client";
import {
  getClubAccentColor,
  getClubBadge,
  getClubDisplayName,
} from "@/lib/clubs";

export type ScheduleMatch = {
  id: string;
  kickoffAt: string;
  status: MatchStatus;
  homeClub: {
    name: string;
    shortName: string | null;
    slug: string | null;
  };
  awayClub: {
    name: string;
    shortName: string | null;
    slug: string | null;
  };
};

const getOrdinalSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return "th";
  const mod = day % 10;
  if (mod === 1) return "st";
  if (mod === 2) return "nd";
  if (mod === 3) return "rd";
  return "th";
};

const formatDateHeader = (date: Date) => {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  return `${weekday}, ${month} ${day}${suffix}`;
};

const formatTimeMarkup = (match: ScheduleMatch) => {
  const kickoff = new Date(match.kickoffAt);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  switch (match.status) {
    case "SCHEDULED":
      return {
        main: `${timeFormatter.format(kickoff)} ET`,
        detail: "Scheduled",
      };
    case "COMPLETED":
      return {
        main: "Final",
        detail: "Score data coming soon",
      };
    case "POSTPONED":
      return {
        main: "Postponed",
        detail: "Check back for updates",
      };
    case "CANCELED":
      return {
        main: "Canceled",
        detail: "Match will not occur",
      };
    default:
      return {
        main: "TBD",
        detail: "More info soon",
      };
  }
};

export default function MatchScheduleList({
  matches,
}: {
  matches: ScheduleMatch[];
}) {
  const router = useRouter();

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { label: string; matches: ScheduleMatch[]; date: Date }
    >();

    for (const match of matches) {
      const kickoff = new Date(match.kickoffAt);
      const key = kickoff.toISOString().split("T")[0];
      const entry = map.get(key);

      if (entry) {
        entry.matches.push(match);
      } else {
        map.set(key, {
          label: formatDateHeader(kickoff),
          matches: [match],
          date: kickoff,
        });
      }
    }

    return Array.from(map.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [matches]);

  const navigateToMatch = useCallback(
    (matchId: string) => {
      router.push(`/matches/${matchId}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <section key={group.key}>
          <div className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {group.label}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {group.matches.map((match) => {
              const homeLabel = getClubDisplayName(
                match.homeClub.slug,
                match.homeClub.name,
              );
              const awayLabel = getClubDisplayName(
                match.awayClub.slug,
                match.awayClub.name,
              );
              const homeColor = getClubAccentColor(match.homeClub.slug);
              const awayColor = getClubAccentColor(match.awayClub.slug);
              const status = formatTimeMarkup(match);
              const homeBadge = getClubBadge(match.homeClub.slug);
              const awayBadge = getClubBadge(match.awayClub.slug);

              const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigateToMatch(match.id);
                }
              };

              return (
                <div
                  key={match.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToMatch(match.id)}
                  onKeyDown={onRowKeyDown}
                  className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-2 transition focus-visible:outline focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 hover:border-[var(--accent)]"
                >
                  <span
                    className="absolute left-0 top-0 h-full w-1 rounded-tr-2xl rounded-br-2xl"
                    style={{ backgroundColor: homeColor }}
                  />
                  <span
                    className="absolute right-0 top-0 h-full w-1 rounded-tl-2xl rounded-bl-2xl"
                    style={{ backgroundColor: awayColor }}
                  />
                  <div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr]">
                    <div className="order-1 flex items-center gap-2">
                      {homeBadge ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={homeBadge}
                          alt={`${homeLabel} badge`}
                          width={32}
                          height={32}
                          className="h-12 w-12 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-xs uppercase"
                          style={{ borderColor: homeColor }}
                        >
                          {homeLabel.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: homeColor }}
                          />
                          {homeLabel}
                        </div>
                        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                          Home
                        </p>
                      </div>
                    </div>

                    <div className="order-2 flex flex-col items-center gap-0 text-center">
                      <span className="text-sm font-semibold uppercase text-[var(--text)]">
                        {status.main}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {status.detail}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigateToMatch(match.id);
                        }}
                        className="mt-0.5 inline-flex items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-muted)]"
                      >
                        View stats
                      </button>
                    </div>

                    <div className="order-3 flex items-center justify-end gap-2">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2 text-sm font-semibold text-[var(--text)]">
                          {awayLabel}
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: awayColor }}
                          />
                        </div>
                        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                          Away
                        </p>
                      </div>
                      {awayBadge ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={awayBadge}
                          alt={`${awayLabel} badge`}
                          width={32}
                          height={32}
                          className="h-12 w-12 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-xs uppercase"
                          style={{ borderColor: awayColor }}
                        >
                          {awayLabel.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
