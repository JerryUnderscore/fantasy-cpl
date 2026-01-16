"use client";

import { useMemo, useState } from "react";

type PlayerOption = {
  id: string;
  name: string;
  position: string;
  clubLabel: string;
};

type MatchWeekOption = {
  id: string;
  number: number;
  name: string | null;
};

type Row = {
  id: string;
  playerId: string;
  minutes: string;
  goals: string;
  assists: string;
  yellowCards: string;
  redCards: string;
  ownGoals: string;
  cleanSheet: boolean;
};

type Props = {
  postUrl: string;
  players: PlayerOption[];
  matchWeeks: MatchWeekOption[];
  canWrite: boolean;
};

const createRow = (index: number): Row => ({
  id: `row-${index}-${Date.now()}`,
  playerId: "",
  minutes: "",
  goals: "",
  assists: "",
  yellowCards: "",
  redCards: "",
  ownGoals: "",
  cleanSheet: false,
});

const parseNumber = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

export default function ScoringAdminClient({
  postUrl,
  players,
  matchWeeks,
  canWrite,
}: Props) {
  const initialMatchWeek =
    matchWeeks.length > 0 ? String(matchWeeks[0].number) : "1";
  const [matchWeekNumber, setMatchWeekNumber] =
    useState<string>(initialMatchWeek);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 5 }, (_, index) => createRow(index)),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playerOptions = useMemo(() => players, [players]);

  const updateRow = (rowId: string, update: Partial<Row>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...update } : row)),
    );
  };

  const addRow = () => {
    setRows((current) => [...current, createRow(current.length + 1)]);
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const submit = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const seenPlayers = new Set<string>();
      const normalizedStats = rows
        .map((row, index) => {
          const playerId = row.playerId.trim();
          const hasAnyInput =
            playerId ||
            row.minutes.trim() ||
            row.goals.trim() ||
            row.assists.trim() ||
            row.yellowCards.trim() ||
            row.redCards.trim() ||
            row.ownGoals.trim() ||
            row.cleanSheet;

          if (!hasAnyInput) {
            return null;
          }

          if (!playerId) {
            return { error: `Row ${index + 1}: select a player.` };
          }
          if (seenPlayers.has(playerId)) {
            return { error: `Row ${index + 1}: duplicate player selected.` };
          }
          seenPlayers.add(playerId);

          const minutes = parseNumber(row.minutes);
          if (minutes === null) {
            return { error: `Row ${index + 1}: minutes are required.` };
          }

          const goals = parseNumber(row.goals) ?? 0;
          const assists = parseNumber(row.assists) ?? 0;
          const yellowCards = parseNumber(row.yellowCards) ?? 0;
          const redCards = parseNumber(row.redCards) ?? 0;
          const ownGoals = parseNumber(row.ownGoals) ?? 0;

          return {
            playerId,
            minutes,
            goals,
            assists,
            yellowCards,
            redCards,
            ownGoals,
            cleanSheet: row.cleanSheet,
          };
        })
        .filter((entry) => entry !== null);

      const firstError = normalizedStats.find(
        (entry): entry is { error: string } => "error" in entry,
      );

      if (firstError) {
        setError(firstError.error);
        return;
      }

      const stats = normalizedStats.filter(
        (entry): entry is Exclude<typeof entry, { error: string }> =>
          !("error" in entry),
      );

      if (!stats.length) {
        setError("Add at least one stat row before saving.");
        return;
      }

      const matchWeekValue = parseNumber(matchWeekNumber);
      if (!matchWeekValue || matchWeekValue <= 0) {
        setError("Select a valid MatchWeek.");
        return;
      }

      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchWeekNumber: matchWeekValue,
          stats,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setError(payload?.error ?? "Unable to save stats");
        return;
      }

      setMessage(`Saved ${payload?.upserted ?? 0} stat rows.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Dev-only tools
        </p>
        <p className="mt-2 text-sm text-zinc-800">
          This endpoint is gated by `ALLOW_DEV_STAT_WRITES=true`.
        </p>
        {!canWrite ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Writes are disabled. Set `ALLOW_DEV_STAT_WRITES=true` to enable
            saving.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">MatchWeek</p>
            <p className="text-xs text-zinc-700">
              Select the matchweek to upsert stats.
            </p>
          </div>
          {matchWeeks.length > 0 ? (
            <select
              value={matchWeekNumber}
              onChange={(event) => setMatchWeekNumber(event.target.value)}
              className="min-w-[180px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {matchWeeks.map((matchWeek) => (
                <option key={matchWeek.id} value={matchWeek.number}>
                  {matchWeek.name
                    ? `${matchWeek.name} (${matchWeek.number})`
                    : `MatchWeek ${matchWeek.number}`}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col items-end gap-2 text-right">
              <input
                type="number"
                min="1"
                value={matchWeekNumber}
                onChange={(event) => setMatchWeekNumber(event.target.value)}
                className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              />
              <p className="text-xs text-zinc-700">
                No MatchWeeks yet. Enter a number.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
            Player stats
          </h2>
          <button
            type="button"
            onClick={addRow}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
          >
            Add row
          </button>
        </div>

        <div className="mt-4 max-h-[420px] overflow-x-auto overflow-y-auto pb-2 pr-2">
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid min-w-full grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:min-w-[1080px] md:grid-cols-[2fr_repeat(6,1fr)_auto]"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Player
                  </label>
                  <select
                    value={row.playerId}
                    onChange={(event) =>
                      updateRow(row.id, { playerId: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="">Select player</option>
                    {playerOptions.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} · {player.position}
                        {player.clubLabel ? ` · ${player.clubLabel}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Min
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.minutes}
                    onChange={(event) =>
                      updateRow(row.id, { minutes: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    G
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.goals}
                    onChange={(event) =>
                      updateRow(row.id, { goals: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    A
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.assists}
                    onChange={(event) =>
                      updateRow(row.id, { assists: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    YC
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.yellowCards}
                    onChange={(event) =>
                      updateRow(row.id, { yellowCards: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    RC
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.redCards}
                    onChange={(event) =>
                      updateRow(row.id, { redCards: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    OG
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.ownGoals}
                    onChange={(event) =>
                      updateRow(row.id, { ownGoals: event.target.value })
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    <input
                      type="checkbox"
                      checked={row.cleanSheet}
                      onChange={(event) =>
                        updateRow(row.id, { cleanSheet: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    CS
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || !canWrite}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save stats"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
          CSV import (coming soon)
        </h3>
        <p className="mt-2 text-sm text-zinc-700">
          Expected columns: playerId, minutes, goals, assists, yellowCards,
          redCards, ownGoals, cleanSheet.
        </p>
      </div>
    </div>
  );
}
