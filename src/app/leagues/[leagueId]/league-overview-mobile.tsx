"use client";

import Link from "next/link";
import { useState } from "react";
import MatchScheduleList, { type ScheduleMatch } from "@/components/match-schedule";
import EmptyState from "@/components/layout/empty-state";
import LocalDateTime from "@/components/local-date-time";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";

type StandingsRow = {
  rank: number;
  teamName: string;
  ownerName: string;
  totalPoints: number;
  playedFinalized: number;
  href: string;
};

type WaiverEntry = {
  id: string;
  waiverAvailableAt: string;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  };
};

type PendingClaim = {
  id: string;
  createdAt: string;
  player: WaiverEntry["player"];
  dropPlayer: WaiverEntry["player"] | null;
};

type Props = {
  leagueId: string;
  leagueName: string;
  backHref: string;
  matchweekLabel: string;
  matchweekContext: string;
  showSettings: boolean;
  standings: StandingsRow[];
  scheduleMatches: ScheduleMatch[];
  waivers: WaiverEntry[];
  pendingClaims: PendingClaim[];
};

export default function LeagueOverviewMobile({
  leagueId,
  leagueName,
  backHref,
  matchweekLabel,
  matchweekContext,
  showSettings,
  standings,
  scheduleMatches,
  waivers,
  pendingClaims,
}: Props) {
  const [tab, setTab] = useState<"standings" | "schedule" | "waivers">(
    "standings",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
        >
          Back
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {leagueName}
          </p>
          <span className="mt-1 rounded-full bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {matchweekLabel}
          </span>
        </div>
        {showSettings ? (
          <Link
            href={`/leagues/${leagueId}/settings`}
            aria-label="League settings"
            className="rounded-full border border-[var(--border)] px-2 py-1 text-[var(--text-muted)]"
          >
            <span role="img" aria-hidden>
              ⚙️
            </span>
          </Link>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="sticky top-0 z-20 -mx-6 bg-[var(--background)] px-6 pb-3 pt-2">
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {matchweekContext}
        </div>
        <div className="mt-3 flex w-full rounded-full border border-[var(--border)] bg-[var(--surface2)] p-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {[
            { key: "standings", label: "Standings" },
            { key: "schedule", label: "Schedule" },
            { key: "waivers", label: "Waivers" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setTab(item.key as "standings" | "schedule" | "waivers")
              }
              className={`flex-1 rounded-full px-3 py-2 text-[11px] ${
                tab === item.key
                  ? "bg-[var(--surface)] text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "standings" ? (
        standings.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Once teams join, standings will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {standings.map((row) => (
              <Link
                key={row.href}
                href={row.href}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    #{row.rank}
                  </span>
                  <div>
                    <p>{row.teamName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {row.ownerName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {row.totalPoints} pts
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {row.playedFinalized} played
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {tab === "schedule" ? (
        scheduleMatches.length === 0 ? (
          <EmptyState
            title="No matches scheduled"
            description="CPL matchups will appear here once the schedule is published."
          />
        ) : (
          <MatchScheduleList matches={scheduleMatches} />
        )
      ) : null}

      {tab === "waivers" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Your pending claims
            </p>
            {pendingClaims.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                No pending waiver claims.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[var(--text)]">
                      {formatPlayerName(
                        claim.player.name,
                        claim.player.jerseyNumber,
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {claim.player.position} ·{" "}
                      {claim.player.club
                        ? getClubDisplayName(
                            claim.player.club.slug,
                            claim.player.club.name,
                          )
                        : "No club"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Drop: {claim.dropPlayer?.name ?? "None"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Submitted: <LocalDateTime value={claim.createdAt} />
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              League activity
            </summary>
            <div className="mt-3">
              {waivers.length === 0 ? (
                <EmptyState
                  title="No players on waivers"
                  description="Waiver claims will appear here when players enter the window."
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {waivers.map((waiver) => (
                    <li
                      key={waiver.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {formatPlayerName(
                          waiver.player.name,
                          waiver.player.jerseyNumber,
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {waiver.player.position} ·{" "}
                        {waiver.player.club
                          ? getClubDisplayName(
                              waiver.player.club.slug,
                              waiver.player.club.name,
                            )
                          : "No club"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Clears: <LocalDateTime value={waiver.waiverAvailableAt} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
