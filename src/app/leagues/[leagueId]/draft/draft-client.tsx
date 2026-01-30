"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatPlayerName } from "@/lib/players";
import { useDraftRealtime } from "./use-draft-realtime";
import {
  clickableRow,
  clickableSurface,
  iconButton,
} from "@/components/layout/ui-interactions";
import {
  getLastNameKey,
  getNameSearchRank,
  normalizeSearchText,
} from "@/lib/search";
import { useSheet } from "@/components/overlays/sheet-provider";
import { useToast } from "@/components/overlays/toast-provider";
import { ROSTER_LIMITS, CLUB_ROSTER_LIMIT } from "@/lib/roster";

type AvailablePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: string | null;
};

type OnTheClock = {
  pickNumber: number;
  round: number;
  slotInRound: number;
  fantasyTeamName: string;
};

type DraftMode = "LIVE" | "CASUAL" | "NONE";

type BoardRound = {
  round: number;
  slots: Array<{
    teamName: string;
    playerName: string | null;
    playerPosition: string | null;
    clubLabel: string | null;
    isCurrentPick: boolean;
    isMyTeam: boolean;
  }>;
};

type Props = {
  leagueId: string;
  draftId: string | null;
  isOwner: boolean;
  draftStatus: "NOT_STARTED" | "LIVE" | "COMPLETE";
  isPaused: boolean;
  pausedRemainingSeconds: number | null;
  queuedPlayerIds: string[];
  onTheClock: OnTheClock | null;
  onDeck: OnTheClock | null;
  totalPicks: number;
  draftMode: DraftMode;
  deadline: string | null;
  scheduledAt: string | null;
  canPick: boolean;
  availablePlayers: AvailablePlayer[];
  boardRounds: BoardRound[];
  rosterCounts: Record<"GK" | "DEF" | "MID" | "FWD", number>;
  rosterSize: number;
  maxGoalkeepers: number;
};

const formatSeconds = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

type ModalMode = "MAKE_PICK" | "FORCE_PICK";

type ModalState = {
  mode: ModalMode;
  selectedPlayerId: string | null;
  search: string;
};

export default function DraftClient({
  leagueId,
  draftId,
  isOwner,
  draftStatus,
  isPaused,
  pausedRemainingSeconds,
  queuedPlayerIds,
  onTheClock,
  onDeck,
  totalPicks,
  draftMode,
  deadline,
  scheduledAt,
  canPick,
  availablePlayers,
  boardRounds,
  rosterCounts,
  rosterSize,
  maxGoalkeepers,
}: Props) {
  const router = useRouter();
  const sheet = useSheet();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUEUED">("ALL");
  const [mobileTab, setMobileTab] = useState<"board" | "queue" | "players">(
    "board",
  );
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobilePositionFilter, setMobilePositionFilter] = useState("ALL");
  const [mobileClubFilter, setMobileClubFilter] = useState("ALL");
  const [mobileQueueIds, setMobileQueueIds] = useState<string[]>(queuedPlayerIds);
  const [queueStatus, setQueueStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [queueError, setQueueError] = useState<string | null>(null);
  const hasLoadedQueue = useRef(false);
  const hasSkippedInitialSave = useRef(false);

  const deadlineMs =
    deadline && !Number.isNaN(new Date(deadline).getTime())
      ? new Date(deadline).getTime()
      : null;

  const remainingSeconds =
    draftMode === "LIVE" &&
    draftStatus === "LIVE" &&
    deadlineMs !== null
      ? Math.max(0, Math.floor((deadlineMs - now) / 1000))
      : null;
  const pausedSeconds =
    typeof pausedRemainingSeconds === "number"
      ? Math.max(0, Math.floor(pausedRemainingSeconds))
      : null;
  const scheduledLabel =
    scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime())
      ? new Date(scheduledAt).toLocaleString()
      : null;

  const refreshDraft = useCallback(() => {
    router.refresh();
  }, [router]);

  const { isConnected: isRealtimeConnected } = useDraftRealtime({
    draftId,
    onChange: refreshDraft,
  });

  useEffect(() => {
    if (deadlineMs === null || draftStatus !== "LIVE" || isPaused) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineMs, draftStatus, isPaused]);

  useEffect(() => {
    if (draftStatus !== "LIVE" || isPaused || draftMode !== "LIVE") return;
    let isActive = true;

    const resolveOverdue = async () => {
      try {
        const res = await fetch(
          `/api/leagues/${leagueId}/draft/resolve-overdue`,
          { method: "POST" },
        );
        const payload = await res.json().catch(() => null);
        if (!isActive) return;
        if (payload?.updated) {
          router.refresh();
        }
      } catch {
        // Ignore resolve errors; polling or realtime will catch up.
      }
    };

    void resolveOverdue();
    const interval = window.setInterval(resolveOverdue, 2500);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [draftStatus, isPaused, draftMode, leagueId, router]);

  useEffect(() => {
    if (draftStatus !== "LIVE" || isPaused) return;
    if (isRealtimeConnected) return;
    const interval = window.setInterval(() => {
      router.refresh();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [draftStatus, isPaused, isRealtimeConnected, router]);

  const filteredPlayers = useMemo(() => {
    const query = normalizeSearchText(modal?.search ?? "");
    const queuedSet = new Set(queuedPlayerIds);
    const filtered = availablePlayers.filter((player) => {
      if (positionFilter !== "ALL" && player.position !== positionFilter) {
        return false;
      }
      if (clubFilter !== "ALL" && player.club !== clubFilter) {
        return false;
      }
      if (statusFilter === "QUEUED" && !queuedSet.has(player.id)) {
        return false;
      }
      if (!query) return true;
      return getNameSearchRank(player.name, query) > 0;
    });

    const queueOrder = new Map(
      queuedPlayerIds.map((id, index) => [id, index]),
    );
    const scored = filtered.map((player) => ({
      player,
      rank: query ? getNameSearchRank(player.name, query) : 0,
      lastName: getLastNameKey(player.name),
      queuedIndex: queueOrder.has(player.id) ? queueOrder.get(player.id) ?? 0 : null,
    }));

    const queued = scored
      .filter((entry) => entry.queuedIndex !== null)
      .sort(
        (a, b) =>
          (a.queuedIndex ?? 0) - (b.queuedIndex ?? 0),
      );
    const others = scored
      .filter((entry) => entry.queuedIndex === null)
      .sort((a, b) => {
        if (a.rank !== b.rank) return b.rank - a.rank;
        const lastNameDiff = a.lastName.localeCompare(b.lastName);
        if (lastNameDiff !== 0) return lastNameDiff;
        return a.player.name.localeCompare(b.player.name);
      });

    return [...queued, ...others].map((entry) => entry.player);
  }, [
    availablePlayers,
    modal?.search,
    positionFilter,
    clubFilter,
    statusFilter,
    queuedPlayerIds,
  ]);

  const clubOptions = useMemo(() => {
    const clubs = new Set<string>();
    availablePlayers.forEach((player) => {
      if (player.club) clubs.add(player.club);
    });
    return ["ALL", ...Array.from(clubs).sort()];
  }, [availablePlayers]);

  const closeModal = () => {
    setModal(null);
    setError(null);
    setPositionFilter("ALL");
    setClubFilter("ALL");
    setStatusFilter("ALL");
  };

  useEffect(() => {
    setMobileQueueIds(queuedPlayerIds);
  }, [queuedPlayerIds]);

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
        setQueueStatus("saved");
      } catch (err) {
        setQueueStatus("error");
        setQueueError(
          err instanceof Error ? err.message : "Failed to save queue",
        );
      }
    },
    [leagueId],
  );

  useEffect(() => {
    if (!hasLoadedQueue.current) {
      hasLoadedQueue.current = true;
      return;
    }
    if (!hasSkippedInitialSave.current) {
      hasSkippedInitialSave.current = true;
      return;
    }
    setQueueStatus("idle");
    void saveQueue(mobileQueueIds);
  }, [mobileQueueIds, saveQueue]);

  const moveQueueItem = (playerId: string, direction: "UP" | "DOWN") => {
    setMobileQueueIds((prev) => {
      const index = prev.indexOf(playerId);
      if (index === -1) return prev;
      const next = [...prev];
      const swapIndex = direction === "UP" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const removeQueueItem = (playerId: string) => {
    setMobileQueueIds((prev) => prev.filter((id) => id !== playerId));
  };

  const mobileQueuedPlayers = useMemo(() => {
    const map = new Map(availablePlayers.map((player) => [player.id, player]));
    return mobileQueueIds
      .map((id) => map.get(id))
      .filter((player): player is AvailablePlayer => Boolean(player));
  }, [mobileQueueIds, availablePlayers]);

  const mobilePlayers = useMemo(() => {
    const query = normalizeSearchText(mobileSearch);
    return availablePlayers.filter((player) => {
      if (mobilePositionFilter !== "ALL" && player.position !== mobilePositionFilter) {
        return false;
      }
      if (mobileClubFilter !== "ALL" && player.club !== mobileClubFilter) {
        return false;
      }
      if (!query) return true;
      return getNameSearchRank(player.name, query) > 0;
    });
  }, [availablePlayers, mobileSearch, mobilePositionFilter, mobileClubFilter]);

  const submitPickRequest = async (playerId: string, mode: ModalMode) => {
    try {
      const endpoint =
        mode === "FORCE_PICK"
          ? `/api/leagues/${leagueId}/draft/force-pick`
          : `/api/leagues/${leagueId}/draft/pick`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          message: data?.error ?? "Unable to draft player",
        } as const;
      }
      router.refresh();
      return { ok: true } as const;
    } catch (err) {
      return {
        ok: false,
        status: 500,
        message: err instanceof Error ? err.message : "Unable to draft player",
      } as const;
    }
  };

  const submitPick = async (mode: ModalMode) => {
    if (!modal?.selectedPlayerId) return;
    setError(null);
    setIsPending(true);
    try {
      const endpoint =
        mode === "FORCE_PICK"
          ? `/api/leagues/${leagueId}/draft/force-pick`
          : `/api/leagues/${leagueId}/draft/pick`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: modal.selectedPlayerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to draft player");
        return;
      }
      closeModal();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const advanceDraft = async () => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/advance`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to auto-pick");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const openModal = (mode: ModalMode) => {
    setModal({ mode, selectedPlayerId: null, search: "" });
    setError(null);
    setPositionFilter("ALL");
    setClubFilter("ALL");
    setStatusFilter("ALL");
  };

  const showManualTools = isOwner && draftMode !== "NONE";
  const canStart = showManualTools && draftStatus === "NOT_STARTED";
  const canPause = showManualTools && draftStatus === "LIVE" && !isPaused;
  const canResume = showManualTools && draftStatus === "LIVE" && isPaused;

  const startDraft = async () => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/start`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to start draft");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const pauseDraft = async () => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/pause`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to pause draft");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const resumeDraft = async () => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/resume`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to resume draft");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const statusLabel = isPaused ? "PAUSED" : draftStatus;
  const timerLabel = isPaused
    ? "Paused"
    : draftMode === "LIVE"
      ? "Time left"
      : "Casual";
  const timerValue = isPaused
    ? pausedSeconds !== null
      ? formatSeconds(pausedSeconds)
      : "—"
    : remainingSeconds !== null
      ? formatSeconds(remainingSeconds)
      : "—";
  const statusPillClass =
    draftStatus === "LIVE" && !isPaused
      ? "border-red-200 bg-red-600 text-white"
      : isPaused
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-white text-zinc-600";

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-30 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Pick {onTheClock?.pickNumber ?? "—"} / {totalPicks || "—"}
            </span>
            <span className="text-sm font-semibold text-[var(--text)]">
              Round {onTheClock?.round ?? "—"} · {statusLabel}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {timerLabel}
            </p>
            <p className="text-lg font-semibold text-[var(--text)]">
              {timerValue}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span>
            On clock: {draftStatus === "LIVE" ? onTheClock?.fantasyTeamName ?? "—" : "—"}
          </span>
          <span>
            On deck: {draftStatus === "LIVE" ? onDeck?.fantasyTeamName ?? "—" : "—"}
          </span>
        </div>
        {canPick && !isPaused ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            You are on the clock. Choose a player to lock in this pick.
          </p>
        ) : null}
      </div>

      <div className="sm:hidden">
        <div className="flex w-full rounded-full border border-[var(--border)] bg-[var(--surface2)] p-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {[
            { key: "board", label: "Board" },
            { key: "queue", label: "Queue" },
            { key: "players", label: "Players" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setMobileTab(item.key as "board" | "queue" | "players")
              }
              className={`flex-1 rounded-full px-3 py-2 text-[11px] ${
                mobileTab === item.key
                  ? "bg-[var(--surface)] text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mobileTab === "board" ? (
          <div className="mt-4 flex flex-col gap-4">
            {boardRounds.map((round) => (
              <div
                key={round.round}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Round {round.round}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {round.slots.map((slot, index) => (
                    <div
                      key={`${round.round}-${slot.teamName}-${index}`}
                      className={`flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm ${
                        slot.isCurrentPick
                          ? "bg-[rgba(199,165,91,0.2)]"
                          : slot.isMyTeam
                            ? "bg-[rgba(96,165,250,0.15)]"
                            : "bg-[var(--surface)]"
                      }`}
                    >
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {slot.teamName}
                        </p>
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {slot.playerName ?? "—"}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {slot.playerPosition && slot.clubLabel
                            ? `${slot.playerPosition} · ${slot.clubLabel}`
                            : "—"}
                        </p>
                      </div>
                      {slot.isCurrentPick ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          On the clock
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {mobileTab === "queue" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-xs text-[var(--text-muted)]">
              Top queue player auto-picked if timer expires.
            </div>
            {queueError ? (
              <div className="rounded-2xl border border-[var(--danger)] bg-[rgba(242,100,100,0.1)] px-4 py-3 text-xs text-[var(--danger)]">
                {queueError}
              </div>
            ) : null}
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {queueStatus === "saving" && "Saving..."}
              {queueStatus === "saved" && "Saved"}
              {queueStatus === "error" && "Save failed"}
            </div>
            {mobileQueuedPlayers.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
                Your queue is empty.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {mobileQueuedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {index + 1}. {formatPlayerName(player.name, player.jerseyNumber)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {player.position} · {player.club ?? "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveQueueItem(player.id, "UP")}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQueueItem(player.id, "DOWN")}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQueueItem(player.id)}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {mobileTab === "players" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-xs text-[var(--text-muted)]">
              Need DEF {Math.max(0, (ROSTER_LIMITS.min.DEF ?? 0) - rosterCounts.DEF)} · Need MID {Math.max(0, (ROSTER_LIMITS.min.MID ?? 0) - rosterCounts.MID)} · Need FWD {Math.max(0, (ROSTER_LIMITS.min.FWD ?? 0) - rosterCounts.FWD)} · Max GK {maxGoalkeepers} · Club limit {CLUB_ROSTER_LIMIT}
            </div>
            <input
              value={mobileSearch}
              onChange={(event) => setMobileSearch(event.target.value)}
              placeholder="Search players"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)]"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={mobilePositionFilter}
                onChange={(event) => setMobilePositionFilter(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="ALL">All positions</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
              <select
                value={mobileClubFilter}
                onChange={(event) => setMobileClubFilter(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                {clubOptions.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-3">
              {mobilePlayers.map((player) => {
                const rosterTotal =
                  rosterCounts.GK + rosterCounts.DEF + rosterCounts.MID + rosterCounts.FWD;
                const rosterFull = rosterTotal >= rosterSize;
                const exceedsGK =
                  player.position === "GK" && rosterCounts.GK >= maxGoalkeepers;
                const disabled = rosterFull || exceedsGK || !canPick || isPaused;
                const reason = rosterFull
                  ? "Roster full"
                  : exceedsGK
                    ? "Max GK reached"
                    : !canPick
                      ? "Not on the clock"
                      : null;
                return (
                  <div
                    key={player.id}
                    className={`rounded-2xl border border-[var(--border)] px-4 py-3 ${
                      disabled ? "bg-[var(--surface2)] opacity-70" : "bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {formatPlayerName(player.name, player.jerseyNumber)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {player.position} · {player.club ?? "—"}
                        </p>
                        {reason ? (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--danger)]">
                            {reason}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          sheet.open({
                            id: `confirm-pick-${player.id}`,
                            title: "Confirm draft pick",
                            subtitle: `Round ${onTheClock?.round ?? "—"} · Pick ${
                              onTheClock?.pickNumber ?? "—"
                            }`,
                            render: () => (
                              <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
                                <p>
                                  Draft {formatPlayerName(player.name, player.jerseyNumber)}.
                                </p>
                                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-xs text-[var(--text-muted)]">
                                  {player.position} · {player.club ?? "—"}
                                </div>
                              </div>
                            ),
                            actions: [
                              { key: "cancel", label: "Cancel", tone: "secondary" },
                              {
                                key: "confirm",
                                label: "Draft player",
                                tone: "primary",
                                autoClose: false,
                                onPress: async (ctx) => {
                                  ctx.setLoading(true);
                                  const result = await submitPickRequest(
                                    player.id,
                                    "MAKE_PICK",
                                  );
                                  ctx.setLoading(false);
                                  if (!result.ok) {
                                    ctx.setError(result.message);
                                    return;
                                  }
                                  toast.success("Pick submitted.");
                                  ctx.close({
                                    type: "action",
                                    payload: { key: "confirm" },
                                  });
                                },
                              },
                            ],
                          });
                        }}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--background)] disabled:opacity-60"
                      >
                        Draft
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <div className="sticky top-6 z-20 rounded-2xl border border-zinc-800 bg-[#0f1115] p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusPillClass}`}
              >
                {statusLabel}
              </span>
              <p className="text-sm text-zinc-300">
                Pick {onTheClock?.pickNumber ?? "—"} / {totalPicks || "—"}
              </p>
              <p className="text-sm text-zinc-300">
                Round {onTheClock?.round ?? "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {timerLabel}
              </p>
              <p className="text-lg font-semibold text-zinc-100">{timerValue}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-[#242424] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Now picking
              </p>
              <p className="text-sm font-semibold text-zinc-100">
                {draftStatus === "LIVE"
                  ? onTheClock?.fantasyTeamName ?? "—"
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#242424] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                On deck
              </p>
              <p className="text-sm font-semibold text-zinc-100">
                {draftStatus === "LIVE" ? onDeck?.fantasyTeamName ?? "—" : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#242424] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Pick
              </p>
              <p className="text-sm font-semibold text-zinc-100">
                {onTheClock?.pickNumber ?? "—"} / {totalPicks || "—"}
              </p>
            </div>
          </div>

          {draftMode === "LIVE" && scheduledLabel && draftStatus === "NOT_STARTED" ? (
            <p className="mt-3 text-xs text-zinc-400">
              Draft starts at: {scheduledLabel}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openModal("MAKE_PICK")}
              disabled={!canPick || isPaused || isPending}
              className={`rounded-full bg-[#c7a55b] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 ${clickableSurface}`}
            >
              Make pick
            </button>
            <button
              type="button"
              onClick={advanceDraft}
              disabled={!canPick || isPaused || isPending}
              className={`rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50 ${clickableSurface}`}
            >
              Auto-pick now
            </button>
            {canPick && !isPaused ? (
              <p className="text-xs text-zinc-500">
                You are on the clock. Choose a player to lock in this pick.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showManualTools ? (
        <div className="hidden flex-wrap items-center gap-3 sm:flex">
          {canStart ? (
            <button
              type="button"
              onClick={startDraft}
              disabled={isPending}
              className={`rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${clickableSurface}`}
            >
              Start draft
            </button>
          ) : null}
          {canResume ? (
            <button
              type="button"
              onClick={resumeDraft}
              disabled={isPending}
              className={`rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${clickableSurface}`}
            >
              Resume draft
            </button>
          ) : null}
          {canPause ? (
            <button
              type="button"
              onClick={pauseDraft}
              disabled={isPending}
              className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60 ${clickableSurface}`}
            >
              Pause draft
            </button>
          ) : null}
          {draftStatus === "LIVE" ? (
            <button
              type="button"
              onClick={() => openModal("FORCE_PICK")}
              disabled={isPending}
              className={`rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${clickableSurface}`}
            >
              Force pick
            </button>
          ) : null}
          <p className="text-xs text-zinc-500">Commissioner tools for this draft.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {modal.mode === "FORCE_PICK" ? "Force a pick" : "Make your pick"}
                </h2>
                <p className="text-xs text-zinc-500">
                  Pick {onTheClock?.pickNumber ?? "—"} · Round {onTheClock?.round ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={`${iconButton} text-sm text-zinc-500 hover:text-zinc-800`}
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <input
                value={modal.search}
                onChange={(event) =>
                  setModal((prev) =>
                    prev
                      ? { ...prev, search: event.target.value }
                      : prev,
                  )
                }
                placeholder="Search players"
                className="w-full rounded-full border border-zinc-200 px-4 py-2 text-sm"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value === "QUEUED" ? "QUEUED" : "ALL",
                    )
                  }
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-800"
                >
                  <option value="ALL">All</option>
                  <option value="QUEUED">Queued</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Position
                <select
                  value={positionFilter}
                  onChange={(event) => setPositionFilter(event.target.value)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-800"
                >
                  <option value="ALL">All</option>
                  <option value="GK">GK</option>
                  <option value="DEF">DEF</option>
                  <option value="MID">MID</option>
                  <option value="FWD">FWD</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Team
                <select
                  value={clubFilter}
                  onChange={(event) => setClubFilter(event.target.value)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-800"
                >
                  {clubOptions.map((club) => (
                    <option key={club} value={club}>
                      {club}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto">
              {filteredPlayers.length === 0 ? (
                <p className="text-sm text-zinc-500">No players found.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredPlayers.map((player) => {
                    const isSelected = modal.selectedPlayerId === player.id;
                    return (
                      <li
                        key={player.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${clickableRow} ${
                          isSelected
                            ? "border-[#c7a55b] bg-[#c7a55b]/10"
                            : "border-zinc-200 hover:border-[#c7a55b] hover:bg-[#c7a55b]/5"
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setModal((prev) =>
                            prev ? { ...prev, selectedPlayerId: player.id } : prev,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setModal((prev) =>
                              prev
                                ? { ...prev, selectedPlayerId: player.id }
                                : prev,
                            );
                          }
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900">
                            {formatPlayerName(player.name, player.jerseyNumber)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {player.position} · {player.club ?? "—"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className={`rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 ${clickableSurface}`}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitPick(modal.mode)}
                disabled={!modal.selectedPlayerId || isPending}
                className={`rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${clickableSurface}`}
              >
                {isPending ? "Submitting..." : "Confirm pick"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
