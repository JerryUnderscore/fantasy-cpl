"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";
import SectionCard from "@/components/layout/section-card";
import {
  clickableRow,
  clickableSurface,
  iconButton,
} from "@/components/layout/ui-interactions";

type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

type Player = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: PlayerPosition;
  club: { shortName: string | null; name: string; slug: string } | null;
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
  return getClubDisplayName(club.slug, club.name);
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
    const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundaryRegex =
      normalizedSearch.length > 0 ? new RegExp(`\\b${escapedSearch}`) : null;
    return players
      .filter((player) => {
        if (positionFilter !== "ALL" && player.position !== positionFilter) {
          return false;
        }
        if (clubFilter !== "ALL") {
          const label = buildClubLabel(player.club);
          if (label !== clubFilter) return false;
        }
        if (!normalizedSearch) return true;
        return player.name.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (!normalizedSearch) {
          if (a.position !== b.position) {
            return positionOrder[a.position] - positionOrder[b.position];
          }
          return a.name.localeCompare(b.name);
        }

        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aRank = aName.startsWith(normalizedSearch)
          ? 0
          : wordBoundaryRegex?.test(aName)
            ? 1
            : 2;
        const bRank = bName.startsWith(normalizedSearch)
          ? 0
          : wordBoundaryRegex?.test(bName)
            ? 1
            : 2;
        if (aRank !== bRank) return aRank - bRank;
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
      hasLoadedQueue.current = true;
    }
  }, [leagueId, playersById]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const saveQueue = useCallback(
    async (nextQueue: string[]) => {
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
        if (payload?.draftId) setDraftId(payload.draftId);
        setQueueStatus("saved");
      } catch (error) {
        setQueueStatus("error");
        setQueueError(
          error instanceof Error ? error.message : "Failed to save queue",
        );
      }
    },
    [leagueId],
  );

  useEffect(() => {
    if (!hasLoadedQueue.current) return;
    if (!hasSkippedInitialSave.current) {
      hasSkippedInitialSave.current = true;
      return;
    }
    setQueueStatus("idle");
    void saveQueue(queueIds);
  }, [queueIds, saveQueue]);

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
      <SectionCard
        title="Player pool"
        description="Search and build your draft queue from the active league roster."
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
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

        <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
          <span>{filteredPlayers.length} players</span>
          <span className="text-xs uppercase tracking-wide">
            {queueIds.length} queued
          </span>
        </div>

        <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl border border-zinc-100 bg-white">
          {filteredPlayers.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No players match these filters.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredPlayers.map((player) => {
                const queued = queueIds.includes(player.id);
                const clubLabel = buildClubLabel(player.club);
                return (
                  <div
                    key={player.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${clickableRow}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {formatPlayerName(player.name, player.jerseyNumber)}
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
                      className={`inline-flex h-9 w-9 items-center justify-center text-sm font-semibold ${iconButton} ${
                        queued
                          ? "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-zinc-300"
                          : "border border-[#c7a55b] bg-[#c7a55b] text-black hover:opacity-90"
                      }`}
                    >
                      {queued ? "✓" : "➕"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <aside className="flex flex-col gap-6">
        <SectionCard title="Roster constraints" description="Current roster">
          <div className="flex flex-col gap-2 text-sm text-zinc-600">
            <div className="flex items-center justify-between">
              <span>Drafted players</span>
              <span className="font-semibold text-zinc-900">
                {Object.values(constraints.rosterCounts).reduce(
                  (sum, count) => sum + count,
                  0,
                )}
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
        </SectionCard>

        <SectionCard
          title="Queue"
          description="Order matters. Top players will auto-fill if you miss a pick."
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {queueIds.length} total
            </span>
          }
        >
          {queueError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {queueError}
            </div>
          ) : null}
          <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">
            {queueStatus === "saving" && "Saving..."}
            {queueStatus === "saved" && "Saved"}
            {queueStatus === "error" && "Save failed"}
          </div>

          <div className="mt-4 flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
            {queuePlayers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                Add players to build your queue.
              </div>
            ) : (
              queuePlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 ${clickableSurface}`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {index + 1}.{" "}
                      {formatPlayerName(player.name, player.jerseyNumber)}
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
                      className={`rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 ${clickableSurface}`}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQueueItem(player.id, "DOWN")}
                      className={`rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 ${clickableSurface}`}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(player.id)}
                      className={`rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 ${clickableSurface}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </aside>
    </div>
  );
}
