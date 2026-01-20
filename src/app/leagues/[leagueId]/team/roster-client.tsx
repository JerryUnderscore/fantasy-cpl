"use client";

import { useMemo, useState } from "react";

type Slot = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
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

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => a.slotNumber - b.slotNumber),
    [slots],
  );

  const starters = useMemo(
    () => sortedSlots.filter((slot) => slot.isStarter),
    [sortedSlots],
  );

  const bench = useMemo(
    () => sortedSlots.filter((slot) => !slot.isStarter),
    [sortedSlots],
  );

  const updateRoster = async (payload: Record<string, unknown>) => {
    if (isLocked) {
      setUpdateError("Lineups are locked for this MatchWeek");
      return;
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
        return;
      }

      if (Array.isArray(data?.slots)) {
        setSlots(data.slots);
      }
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

  const renderSlot = (slot: Slot) => {
    const selected = selectedSlotId === slot.id;
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
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Slot {slot.slotNumber}
          </p>
          {slot.player ? (
            <p className="text-base font-semibold text-zinc-900">
              {slot.player.name}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Empty slot</p>
          )}
          {slot.player ? (
            <p className="text-xs text-zinc-500">
              {slot.player.position} · {slot.player.club?.shortName ?? ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleStarter(slot, !slot.isStarter);
            }}
            disabled={!slot.player || isUpdating || isLocked}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              slot.isStarter
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600"
            } disabled:opacity-60`}
          >
            {slot.isStarter ? "Bench" : "Starter"}
          </button>
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
              Clear
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Lineup rules</p>
            <p className="text-xs text-zinc-500">
              11 starters · max 1 GK · min 3 DEF · min 3 MID · min 1 FWD
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
