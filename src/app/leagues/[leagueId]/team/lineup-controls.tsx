"use client";

import { useState } from "react";

type Props = {
  leagueId: string;
  matchWeekNumber: number;
  isLocked?: boolean;
};

export default function LineupControls({
  leagueId,
  matchWeekNumber,
  isLocked = false,
}: Props) {
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveLineup = async () => {
    if (isLocked) {
      setLineupError("Lineups are locked for this MatchWeek");
      return;
    }

    setLineupError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/team/lineup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchWeekNumber }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setLineupError(data?.error ?? "Lineup validation failed");
        return;
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">Lineup rules</p>
        <p className="mt-1 text-xs text-zinc-500">
          11 starters · max 1 GK · min 3 DEF · min 3 MID · min 1 FWD
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Viewing MatchWeek {matchWeekNumber} lineup
        </p>
        <button
          type="button"
          onClick={saveLineup}
          disabled={isSaving || isLocked}
          className="mt-4 w-full rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save lineup"}
        </button>
        {lineupError ? (
          <p className="mt-3 text-sm text-red-600">{lineupError}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Swap tips
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Drag any bench player onto a starter slot to make the swap.
        </p>
        {isLocked ? (
          <p className="mt-3 text-sm font-semibold text-amber-600">
            Lineups are locked for this MatchWeek.
          </p>
        ) : null}
      </div>
    </div>
  );
}
