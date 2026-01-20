"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

type Player = {
  id: string;
  name: string;
  position: PlayerPosition;
  club: { shortName: string | null; name: string } | null;
};

type Constraints = {
  rosterSize: number;
  positionLimits: Record<PlayerPosition, number> | null;
  rosterCounts: Record<PlayerPosition, number>;
  maxGoalkeepers: number;
  keepersEnabled?: boolean;
  keeperCount?: number | null;
};

type QueueItem = { playerId: string; rank: number };

type QueueResponse = {
  draftId: string | null;
  items: QueueItem[];
};

type Props = {
  leagueId: string;
  constraints: Constraints;
  players: Player[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

type PositionFilter = "ALL" | PlayerPosition;

const positionOrder: Record<PlayerPosition, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

const positionLabel = (position: PlayerPosition) => position;

const buildClubLabel = (club: Player["club"]) => {
  if (!club) return "Unknown club";
  return club.shortName ?? club.name;
};

export default function DraftPrepClient({
  leagueId,
  constraints,
  players,
}: Props) {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<SaveState>("idle");
  const [draftId, setDraftId] = useState<string | null>(null);
  const hasLoadedQueue = useRef(false);
  const hasSkippedInitialSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playersById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player]));
  }, [players]);

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((player) => {
      const label = buildClubLabel(player.club);
      map.set(label, label);
    });
    return ["ALL", ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return players
      .filter((player) => {
        if (
          normalizedSearch &&
          !player.name.toLowerCase().includes(normalizedSearch)
        ) {
          return false;
        }
        if (positionFilter !== "ALL" && player.position !== positionFilter) {
          return false;
        }
        if (clubFilter !== "ALL") {
          const label = buildClubLabel(player.club);
          if (label !== clubFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.position !== b.position) {
          return positionOrder[a.position] - positionOrder[b.position];
        }
        return a.name.localeCompare(b.name);
      });
  }, [players, search, positionFilter, clubFilter]);

  const queuePlayers = useMemo(() => {
    return queueIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));
  }, [queueIds, playersById]);

  useEffect(() => {
    if (!hasLoadedQueue.current) return;
    setQueueIds((prev) => prev.filter((id) => playersById.has(id)));
  }, [playersById]);

  const canSaveQueue = Boolean(draftId);

  const loadQueue = useCallback(async () => {
    setQueueError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft-prep/queue`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as QueueResponse | null;
      if (!res.ok) {
        throw new Error((payload as { error?: string })?.error ?? "Failed to load");
      }
      const items = payload?.items ?? [];
      const ordered = [...items]
        .sort((a, b) => a.rank - b.rank)
        .map((item) => item.playerId);
      setDraftId(payload?.draftId ?? null);
      hasSkippedInitialSave.current = false;
      setQueueIds(ordered.filter((id) => playersById.has(id)));
      hasLoadedQueue.current = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load queue";
      setQueueError(message);
    }
  }, [leagueId, playersById]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const saveQueue = useCallback(
    async (nextQueue: string[]) => {
      if (!canSaveQueue) return;
      setQueueStatus("saving");
      setQueueError(null);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/draft-prep/queue`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queue: nextQueue }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to save queue");
        }
        setQueueStatus("saved");
      } catch (error) {
        setQueueStatus("error");
        setQueueError(
          error instanceof Error ? error.message : "Failed to save queue",
        );
      }
    },
    [leagueId, canSaveQueue],
  );

  useEffect(() => {
    if (!hasLoadedQueue.current) return;
    if (!canSaveQueue) return;
    if (!hasSkippedInitialSave.current) {
      hasSkippedInitialSave.current = true;
      return;
    }
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    setQueueStatus("idle");
    saveTimeout.current = setTimeout(() => {
      void saveQueue(queueIds);
    }, 600);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [queueIds, saveQueue, canSaveQueue]);

  const addToQueue = (playerId: string) => {
    setQueueIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
  };

  const removeFromQueue = (playerId: string) => {
    setQueueIds((prev) => prev.filter((id) => id !== playerId));
  };

  const moveQueueItem = (playerId: string, direction: "UP" | "DOWN") => {
    setQueueIds((prev) => {
      const index = prev.indexOf(playerId);
      if (index === -1) return prev;
      const next = [...prev];
      const swapIndex = direction === "UP" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-black">Player pool</h2>
          <p className="text-sm text-zinc-500">
            Search and build your draft queue from the active league roster.
          </p>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Position
            <select
              value={positionFilter}
              onChange={(event) =>
                setPositionFilter(event.target.value as PositionFilter)
              }
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="GK">GK</option>
              <option value="DEF">DEF</option>
              <option value="MID">MID</option>
              <option value="FWD">FWD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Club
            <select
              value={clubFilter}
              onChange={(event) => setClubFilter(event.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none"
            >
              {clubOptions.map((club) => (
                <option key={club} value={club}>
                  {club}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
          <span>{filteredPlayers.length} players</span>
          <span className="text-xs uppercase tracking-wide">
            {queueIds.length} queued
          </span>
        </div>

        <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-white">
          {filteredPlayers.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No players match these filters.
            </div>
          ) : (
            filteredPlayers.map((player) => {
              const queued = queueIds.includes(player.id);
              const clubLabel = buildClubLabel(player.club);
              return (
                <div
                  key={player.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {player.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {positionLabel(player.position)} - {clubLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={queued ? "Remove from queue" : "Add to queue"}
                    aria-label={queued ? "Remove from queue" : "Add to queue"}
                    onClick={() =>
                      queued
                        ? removeFromQueue(player.id)
                        : addToQueue(player.id)
                    }
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                      queued
                        ? "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-zinc-300"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {queued ? "✓" : "➕"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-6">
        <section className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Roster constraints
          </p>
          <p className="mt-1 text-xs text-zinc-500">Current roster</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
            <div className="flex items-center justify-between">
              <span>Roster size</span>
              <span className="font-semibold text-zinc-900">
                {constraints.rosterSize}
              </span>
            </div>
            {constraints.positionLimits ? (
              <div className="grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs">
                {(Object.keys(constraints.positionLimits) as PlayerPosition[])
                  .sort((a, b) => positionOrder[a] - positionOrder[b])
                  .map((position) => (
                    <div key={position} className="flex justify-between">
                      <span>
                        {positionLabel(position)}{" "}
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {position === "GK"
                            ? `(max ${constraints.maxGoalkeepers})`
                            : `(min ${constraints.positionLimits?.[position] ?? 0})`}
                        </span>
                      </span>
                      <span className="font-semibold text-zinc-800">
                        {constraints.rosterCounts[position] ?? 0}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Position limits will appear after rosters are configured.
              </p>
            )}
            {constraints.keepersEnabled ? (
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>Keepers</span>
                <span className="font-semibold text-zinc-800">
                  {constraints.keeperCount ?? 0}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-black">Queue</h2>
              <p className="text-xs text-zinc-500">
                Order matters. Top players will auto-fill if you miss a pick.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {queueIds.length} total
            </span>
          </div>

          {!canSaveQueue ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
              Draft queue will save once the draft has been created.
            </div>
          ) : null}
          {queueError ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {queueError}
            </div>
          ) : null}
          <div className="mt-4 text-xs uppercase tracking-wide text-zinc-500">
            {queueStatus === "saving" && "Saving..."}
            {queueStatus === "saved" && "Saved"}
            {queueStatus === "error" && "Save failed"}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {queuePlayers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                Add players to build your queue.
              </div>
            ) : (
              queuePlayers.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {index + 1}. {player.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {positionLabel(player.position)} - {buildClubLabel(
                        player.club,
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveQueueItem(player.id, "UP")}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQueueItem(player.id, "DOWN")}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(player.id)}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
