"use client";

import { useEffect, useMemo, useState } from "react";
import { getClubDisplayName } from "@/lib/clubs";
import LocalDateTime from "@/components/local-date-time";

type MatchWeekOption = {
  id: string;
  number: number;
  name: string | null;
  status: string;
};

type MatchPlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  clubLabel: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  cleanSheet: boolean;
};

type MatchPayload = {
  id: string;
  kickoffAt: string;
  status: string;
  homeClub: { slug: string | null; shortName: string | null; name: string };
  awayClub: { slug: string | null; shortName: string | null; name: string };
  homePlayers: MatchPlayer[];
  awayPlayers: MatchPlayer[];
};

type Props = {
  matchWeeks: MatchWeekOption[];
  title?: string;
};

const formatMatchWeekLabel = (week: MatchWeekOption) =>
  week.name ? `${week.name} (MW ${week.number})` : `MatchWeek ${week.number}`;

export default function AdminMobileReadonly({ matchWeeks, title }: Props) {
  const [selectedWeekId] = useState(matchWeeks[0]?.id ?? null);
  const [matches, setMatches] = useState<MatchPayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectedWeek = matchWeeks.find((week) => week.id === selectedWeekId) ?? null;

  useEffect(() => {
    if (!selectedWeekId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/admin/matchweeks/matches?matchWeekId=${selectedWeekId}`,
        );
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Unable to load matchweek matches");
        }
        if (!active) return;
        setMatches((payload?.matches ?? []) as MatchPayload[]);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load matches");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedWeekId]);

  const summary = useMemo(() => {
    const totalMatches = matches.length;
    const totalGoals = matches.reduce(
      (sum, match) =>
        sum +
        match.homePlayers.reduce((acc, player) => acc + player.goals, 0) +
        match.awayPlayers.reduce((acc, player) => acc + player.goals, 0),
      0,
    );
    const totalAssists = matches.reduce(
      (sum, match) =>
        sum +
        match.homePlayers.reduce((acc, player) => acc + player.assists, 0) +
        match.awayPlayers.reduce((acc, player) => acc + player.assists, 0),
      0,
    );
    return { totalMatches, totalGoals, totalAssists };
  }, [matches]);

  return (
    <div className="sm:hidden">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {title ?? "Matchweek overview"}
        </p>
        <p className="mt-2 text-sm text-[var(--text)]">
          {selectedWeek ? formatMatchWeekLabel(selectedWeek) : "No matchweek"}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Status: {selectedWeek?.status ?? "—"}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>{summary.totalMatches} matches</span>
          <span>{summary.totalGoals} goals</span>
          <span>{summary.totalAssists} assists</span>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-[var(--danger)] bg-[rgba(242,100,100,0.1)] px-4 py-3 text-xs text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {matches.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
            No matches available.
          </div>
        ) : (
          matches.map((match) => {
            const homeLabel = getClubDisplayName(
              match.homeClub.slug,
              match.homeClub.name,
            );
            const awayLabel = getClubDisplayName(
              match.awayClub.slug,
              match.awayClub.name,
            );
            const homeGoals = match.homePlayers.reduce(
              (sum, player) => sum + player.goals,
              0,
            );
            const awayGoals = match.awayPlayers.reduce(
              (sum, player) => sum + player.goals,
              0,
            );
            const homeAssists = match.homePlayers.reduce(
              (sum, player) => sum + player.assists,
              0,
            );
            const awayAssists = match.awayPlayers.reduce(
              (sum, player) => sum + player.assists,
              0,
            );

            return (
              <div
                key={match.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {homeLabel} vs {awayLabel}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      <LocalDateTime value={match.kickoffAt} />
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {match.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{homeLabel}</p>
                    <p>Goals: {homeGoals}</p>
                    <p>Assists: {homeAssists}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text)]">{awayLabel}</p>
                    <p>Goals: {awayGoals}</p>
                    <p>Assists: {awayAssists}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
