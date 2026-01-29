"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatPlayerName } from "@/lib/players";
import { useDraftRealtime } from "./use-draft-realtime";

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
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUEUED">("ALL");

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
    const query = modal?.search.trim().toLowerCase() ?? "";
    const queuedSet = new Set(queuedPlayerIds);
    const filtered = availablePlayers.filter((player) => {
      if (
        positionFilter !== "ALL" &&
        player.position !== positionFilter
      ) {
        return false;
      }
      if (clubFilter !== "ALL" && player.club !== clubFilter) {
        return false;
      }
      if (statusFilter === "QUEUED" && !queuedSet.has(player.id)) {
        return false;
      }
      if (!query) return true;
      const jerseyLabel =
        player.jerseyNumber !== null ? String(player.jerseyNumber) : "";
      return `${player.name} ${jerseyLabel} ${player.position} ${player.club ?? ""}`
        .toLowerCase()
        .includes(query);
    });

    const queueOrder = new Map(
      queuedPlayerIds.map((id, index) => [id, index]),
    );
    const queued: AvailablePlayer[] = [];
    const others: AvailablePlayer[] = [];
    for (const player of filtered) {
      if (queueOrder.has(player.id)) {
        queued.push(player);
      } else {
        others.push(player);
      }
    }
    queued.sort(
      (a, b) =>
        (queueOrder.get(a.id) ?? 0) - (queueOrder.get(b.id) ?? 0),
    );
    return [...queued, ...others];
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
            className="rounded-full bg-[#c7a55b] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Make pick
          </button>
          <button
            type="button"
            onClick={advanceDraft}
            disabled={!canPick || isPaused || isPending}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"
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

      {showManualTools ? (
        <div className="flex flex-wrap items-center gap-3">
          {canStart ? (
            <button
              type="button"
              onClick={startDraft}
              disabled={isPending}
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Start draft
            </button>
          ) : null}
          {canResume ? (
            <button
              type="button"
              onClick={resumeDraft}
              disabled={isPending}
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Resume draft
            </button>
          ) : null}
          {canPause ? (
            <button
              type="button"
              onClick={pauseDraft}
              disabled={isPending}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
            >
              Pause draft
            </button>
          ) : null}
          {draftStatus === "LIVE" ? (
            <>
              <button
                type="button"
                onClick={() => openModal("FORCE_PICK")}
                disabled={isPending}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Force pick
              </button>
            </>
          ) : null}
          <p className="text-xs text-zinc-500">
            Commissioner tools for this draft.
          </p>
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
                className="text-sm text-zinc-500 hover:text-zinc-800"
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
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
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
                            {formatPlayerName(
                              player.name,
                              player.jerseyNumber,
                            )}
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
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitPick(modal.mode)}
                disabled={!modal.selectedPlayerId || isPending}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
