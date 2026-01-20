"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Slot = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  } | null;
};

type Props = {
  leagueId: string;
  initialSlots: Slot[];
  matchWeekNumber: number;
  isLocked?: boolean;
};

export default function RosterClient({
  leagueId,
  initialSlots,
  matchWeekNumber,
  isLocked = false,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [starterSwapOpen, setStarterSwapOpen] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<Slot | null>(null);

  useEffect(() => {
    setSlots(initialSlots);
    setSelectedSlotId(null);
    setUpdateError(null);
    setLineupError(null);
  }, [initialSlots, matchWeekNumber]);

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => a.slotNumber - b.slotNumber),
    [slots],
  );

  const starters = useMemo(
    () => sortedSlots.filter((slot) => slot.isStarter),
    [sortedSlots],
  );

  const bench = useMemo(() => {
    const benchSlots = sortedSlots.filter((slot) => !slot.isStarter);
    return benchSlots.sort((a, b) => {
      const aEmpty = a.player ? 0 : 1;
      const bEmpty = b.player ? 0 : 1;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      return a.slotNumber - b.slotNumber;
    });
  }, [sortedSlots]);

  const updateRoster = async (payload: Record<string, unknown>) => {
    if (isLocked) {
      setUpdateError("Lineups are locked for this MatchWeek");
      return false;
    }

    setUpdateError(null);
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/team/roster`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, matchWeekNumber }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setUpdateError(data?.error ?? "Unable to update roster");
        return false;
      }

      if (Array.isArray(data?.slots)) {
        setSlots(data.slots);
      }

      return true;
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleStarter = (slot: Slot, isStarter: boolean) => {
    updateRoster({ action: "starter", slotId: slot.id, isStarter });
  };

  const clearSlot = (slot: Slot) => {
    updateRoster({ action: "clear", slotId: slot.id });
  };

  const handleSlotClick = (slot: Slot) => {
    if (isLocked) {
      setUpdateError("Lineups are locked for this MatchWeek");
      return;
    }

    setLineupError(null);

    if (selectedSlotId === slot.id) {
      setSelectedSlotId(null);
      return;
    }

    if (!selectedSlotId) {
      setSelectedSlotId(slot.id);
      return;
    }

    updateRoster({
      action: "swap",
      slotId: selectedSlotId,
      targetSlotId: slot.id,
    });
    setSelectedSlotId(null);
  };

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

  const requestStarterChange = (slot: Slot) => {
    if (slot.isStarter || starters.length < 11) {
      toggleStarter(slot, !slot.isStarter);
      return;
    }

    setPendingStarter(slot);
    setStarterSwapOpen(true);
  };

  const confirmStarterSwap = async (starterSlotId: string) => {
    if (!pendingStarter) return;
    if (isUpdating) return;

    const starterToBench = starters.find((slot) => slot.id === starterSlotId);
    if (!starterToBench) {
      setUpdateError("Select a starter to move to the bench.");
      return;
    }

    const benchSuccess = await updateRoster({
      action: "starter",
      slotId: starterToBench.id,
      isStarter: false,
    });
    if (!benchSuccess) return;

    const startSuccess = await updateRoster({
      action: "starter",
      slotId: pendingStarter.id,
      isStarter: true,
    });

    if (startSuccess) {
      setStarterSwapOpen(false);
      setPendingStarter(null);
    }
  };

  const renderSlot = (slot: Slot) => {
    const selected = selectedSlotId === slot.id;
    const playerLabel = slot.player
      ? slot.player.jerseyNumber != null
        ? `${slot.player.name} (${slot.player.jerseyNumber})`
        : slot.player.name
      : null;
    return (
      <li
        key={slot.id}
        onClick={() => handleSlotClick(slot)}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 transition ${
          selected
            ? "border-black bg-white"
            : "border-zinc-200 bg-white hover:border-zinc-300"
        }`}
      >
        <div className="flex flex-col">
          {slot.player ? (
            <p className="text-base font-semibold text-zinc-900">
              {playerLabel}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Open roster spot</p>
          )}
          {slot.player ? (
            <p className="text-xs text-zinc-500">
              {slot.player.position} · {slot.player.club?.shortName ?? ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {slot.player ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                requestStarterChange(slot);
              }}
              disabled={isUpdating || isLocked}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                slot.isStarter
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 text-zinc-600"
              } disabled:opacity-60`}
            >
              {slot.isStarter ? "Bench" : "Starter"}
            </button>
          ) : (
            <Link
              href={`/leagues/${leagueId}/players`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-300"
            >
              Add Player
            </Link>
          )}
          {slot.player && !slot.isStarter ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearSlot(slot);
              }}
              disabled={isUpdating || isLocked}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 disabled:opacity-60"
            >
              Drop
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {starterSwapOpen && pendingStarter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-zinc-900">
              Starter limit reached
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Choose a starter to move to the bench so{" "}
              {pendingStarter.player?.name ?? "this player"} can start.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {starters.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => confirmStarterSwap(slot.id)}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:border-zinc-300 disabled:opacity-60"
                >
                  <span>
                    {slot.player?.name ?? "Unknown player"} ·{" "}
                    {slot.player?.position ?? "MID"}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-zinc-400">
                    Bench
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setStarterSwapOpen(false);
                  setPendingStarter(null);
                }}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Lineup rules</p>
            <p className="text-xs text-zinc-500">
              11 starters · max 1 GK · min 3 DEF · min 3 MID · min 1 FWD
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Viewing MatchWeek {matchWeekNumber} lineup
            </p>
          </div>
          <button
            type="button"
            onClick={saveLineup}
            disabled={isSaving || isLocked}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save lineup"}
          </button>
        </div>
        {lineupError ? (
          <p className="mt-3 text-sm text-red-600">{lineupError}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Swap mode
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Click a slot to select it, then click another slot to swap players.
        </p>
        {updateError ? (
          <p className="mt-2 text-sm text-red-600">{updateError}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Starters ({starters.length}/11)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {starters.length ? (
              starters.map(renderSlot)
            ) : (
              <li className="rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                No starters selected yet.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Bench ({bench.length}/4)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {bench.map(renderSlot)}
          </ul>
        </div>
      </div>
    </div>
  );
}
