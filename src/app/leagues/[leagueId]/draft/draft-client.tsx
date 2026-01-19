"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type AvailablePlayer = {
  id: string;
  name: string;
  position: string;
  club: string | null;
};

type OnTheClock = {
  pickNumber: number;
  round: number;
  slotInRound: number;
  fantasyTeamName: string;
};

type DraftMode = "ASYNC" | "TIMED" | "MANUAL";

type Props = {
  leagueId: string;
  isOwner: boolean;
  draftStatus: "NOT_STARTED" | "LIVE" | "COMPLETE";
  onTheClock: OnTheClock | null;
  draftMode: DraftMode;
  deadline: string | null;
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
  isOwner,
  draftStatus,
  onTheClock,
  draftMode,
  deadline,
  canPick,
  availablePlayers,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const deadlineMs =
    deadline && !Number.isNaN(new Date(deadline).getTime())
      ? new Date(deadline).getTime()
      : null;

  const remainingSeconds =
    draftMode === "TIMED" &&
    draftStatus === "LIVE" &&
    deadlineMs !== null
      ? Math.max(0, Math.floor((deadlineMs - now) / 1000))
      : null;

  useEffect(() => {
    if (deadlineMs === null || draftStatus !== "LIVE") return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineMs, draftStatus]);

  const filteredPlayers = useMemo(() => {
    const query = modal?.search.trim().toLowerCase() ?? "";
    if (!query) return availablePlayers;
    return availablePlayers.filter((player) =>
      `${player.name} ${player.position} ${player.club ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [availablePlayers, modal?.search]);

  const closeModal = () => {
    setModal(null);
    setError(null);
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
  };

  const showManualTools = isOwner && draftMode === "MANUAL";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
            {draftStatus}
          </span>
          <p className="text-sm text-zinc-700">
            Pick {onTheClock?.pickNumber ?? "—"}
          </p>
          <p className="text-sm text-zinc-700">
            Round {onTheClock?.round ?? "—"}
          </p>
          <p className="text-sm text-zinc-700">
            On the clock: {draftStatus === "LIVE" ? onTheClock?.fantasyTeamName ?? "—" : "—"}
          </p>
        </div>
        <div className="text-sm text-zinc-600">
          {draftMode === "TIMED" ? (
            remainingSeconds !== null ? (
              <span>Time left: {formatSeconds(remainingSeconds)}</span>
            ) : (
              <span>Timed draft</span>
            )
          ) : draftMode === "MANUAL" ? (
            <span>Manual draft</span>
          ) : (
            <span>Untimed draft</span>
          )}
        </div>
      </div>

      {canPick ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openModal("MAKE_PICK")}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Make pick
          </button>
          <p className="text-xs text-zinc-500">
            You are on the clock. Choose a player to lock in this pick.
          </p>
        </div>
      ) : null}

      {showManualTools ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={advanceDraft}
            disabled={isPending}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
          >
            Auto-pick now
          </button>
          <button
            type="button"
            onClick={() => openModal("FORCE_PICK")}
            disabled={isPending}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Force pick
          </button>
          <p className="text-xs text-zinc-500">
            Commissioner tools for manual drafts.
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
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                          isSelected
                            ? "border-black bg-zinc-50"
                            : "border-zinc-200"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900">
                            {player.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {player.position} · {player.club ?? "—"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setModal((prev) =>
                              prev
                                ? { ...prev, selectedPlayerId: player.id }
                                : prev,
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isSelected
                              ? "bg-black text-white"
                              : "border border-zinc-200 text-zinc-600"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
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
