"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPlayerName } from "@/lib/players";

type ScoreComponents = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
};

type BreakdownItem = {
  playerId: string;
  playerName: string;
  jerseyNumber: number | null;
  position: string;
  clubSlug: string | null;
  minutes: number;
  points: number;
  components: ScoreComponents;
};

type ScoringResponse = {
  ok: boolean;
  totalPoints: number;
  startersCount: number;
  breakdown: BreakdownItem[];
};

type Props = {
  leagueId: string;
  matchWeekNumber?: number;
};

export default function ScoringCard({
  leagueId,
  matchWeekNumber = 1,
}: Props) {
  const [data, setData] = useState<ScoringResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/scoring?matchWeek=${matchWeekNumber}`,
      );
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setError(payload?.error ?? "Unable to load scoring");
        return;
      }

      setData(payload as ScoringResponse);
    } finally {
      setLoading(false);
    }
  }, [leagueId, matchWeekNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const breakdown = data?.breakdown ?? [];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Scoring (MatchWeek {matchWeekNumber})
          </p>
          <p className="text-lg font-semibold text-zinc-900">
            Total: {data?.totalPoints ?? 0} pts
          </p>
          <p className="text-xs text-zinc-500">
            Starters counted: {data?.startersCount ?? 0}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 grid gap-3">
        {breakdown.length ? (
          breakdown.slice(0, 10).map((entry) => (
            <div
              key={entry.playerId}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {formatPlayerName(entry.playerName, entry.jerseyNumber)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {entry.position} · {entry.clubSlug ?? ""} · {entry.minutes}m
                  </p>
                </div>
                <p className="text-sm font-semibold text-zinc-900">
                  {entry.points} pts
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>App {entry.components.appearance}</span>
                <span>G {entry.components.goals}</span>
                <span>A {entry.components.assists}</span>
                <span>CS {entry.components.cleanSheet}</span>
                <span>YC {entry.components.yellowCards}</span>
                <span>RC {entry.components.redCards}</span>
                <span>OG {entry.components.ownGoals}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No starter stats yet.</p>
        )}
      </div>
    </div>
  );
}
