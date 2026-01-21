"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";

type PositionKey = "GK" | "DEF" | "MID" | "FWD";

const POSITION_KEYS: PositionKey[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<PositionKey, string> = {
  GK: "Goalkeeper",
  DEF: "Defense",
  MID: "Midfield",
  FWD: "Attack",
};

type Slot = {
  id: string;
  slotNumber: number;
  position: string;
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

const getPositionKey = (slot: Slot): PositionKey => {
  const candidate = slot.position || slot.player?.position || "MID";
  return POSITION_KEYS.includes(candidate as PositionKey)
    ? (candidate as PositionKey)
    : "MID";
};

const getKitSrc = (slot: Slot) =>
  slot.player?.club?.slug ? `/kits/${slot.player.club.slug}.svg` : null;

export default function RosterClient({
  leagueId,
  initialSlots,
  matchWeekNumber,
  isLocked = false,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [starterSwapOpen, setStarterSwapOpen] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<Slot | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    setSlots(initialSlots);
    setUpdateError(null);
    setDraggedSlotId(null);
    setDropTargetId(null);
    setStarterSwapOpen(false);
    setPendingStarter(null);
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

  const startersByPosition = useMemo(() => {
    const grouped: Record<PositionKey, Slot[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };

    starters.forEach((slot) => {
      grouped[getPositionKey(slot)].push(slot);
    });

    POSITION_KEYS.forEach((key) => {
      grouped[key].sort((a, b) => a.slotNumber - b.slotNumber);
    });

    return grouped;
  }, [starters]);

  const draggedSlot = useMemo(
    () => slots.find((slot) => slot.id === draggedSlotId) ?? null,
    [slots, draggedSlotId],
  );

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

  const clearSlot = (slot: Slot) => {
    updateRoster({ action: "clear", slotId: slot.id });
  };

  const toggleStarter = (slot: Slot, isStarter: boolean) => {
    updateRoster({ action: "starter", slotId: slot.id, isStarter });
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
    if (!pendingStarter || isUpdating) return;

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

  const canDragFromBench = (slot: Slot) =>
    !isLocked &&
    !isUpdating &&
    !slot.isStarter &&
    Boolean(slot.player);

  const canDropOnStarter = (slot: Slot) =>
    Boolean(
      !isLocked &&
        !isUpdating &&
        slot.isStarter &&
        draggedSlot &&
        draggedSlot.id !== slot.id &&
        !draggedSlot.isStarter &&
        draggedSlot.player,
    );

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    slot: Slot,
  ) => {
    if (!canDragFromBench(slot)) return;
    event.dataTransfer.setData("text/plain", slot.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggedSlotId(slot.id);
  };

  const handleDragEnd = () => {
    setDraggedSlotId(null);
    setDropTargetId(null);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    slot: Slot,
  ) => {
    if (!canDropOnStarter(slot)) return;
    event.preventDefault();
    if (dropTargetId !== slot.id) {
      setDropTargetId(slot.id);
    }
  };

  const handleDrop = async (
    event: DragEvent<HTMLDivElement>,
    slot: Slot,
  ) => {
    if (!canDropOnStarter(slot) || !draggedSlot) return;
    event.preventDefault();
    setDropTargetId(null);
    const success = await updateRoster({
      action: "swap",
      slotId: draggedSlot.id,
      targetSlotId: slot.id,
    });
    if (success) {
      setDraggedSlotId(null);
    }
  };

  const renderPitchSlot = (slot: Slot) => {
    const canDrop = canDropOnStarter(slot);
    const isDropTarget = dropTargetId === slot.id;
    const playerLabel = slot.player
      ? slot.player.jerseyNumber != null
        ? `${slot.player.name} (${slot.player.jerseyNumber})`
        : slot.player.name
      : null;

    return (
      <div
        key={slot.id}
        onDragOver={(event) => handleDragOver(event, slot)}
        onDragLeave={() => {
          if (dropTargetId === slot.id) {
            setDropTargetId(null);
          }
        }}
        onDrop={(event) => handleDrop(event, slot)}
        className={`flex w-full max-w-[160px] flex-col items-center gap-2 rounded-2xl px-2 py-3 transition ${
          isDropTarget
            ? "bg-white/20 ring-2 ring-amber-200"
            : "bg-transparent"
        } ${canDrop ? "cursor-copy" : ""}`}
      >
        <div
          className={`relative flex h-16 w-16 items-center justify-center rounded-[18px] border-2 shadow-sm transition ${
            slot.player
              ? "border-white/70 bg-white/10"
              : "border-white/50 border-dashed bg-white/10 text-white/70"
          }`}
        >
          {slot.player ? (
            <>
              {getKitSrc(slot) ? (
                <img
                  src={getKitSrc(slot) ?? ""}
                  alt={slot.player.club?.shortName ?? "Club kit"}
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <span className="text-lg font-semibold text-white">#</span>
              )}
              {slot.player.jerseyNumber != null ? (
                <span className="absolute bottom-[-6px] right-[-6px] flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-emerald-950 shadow-sm">
                  {slot.player.jerseyNumber}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-lg font-semibold text-white">#</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            {POSITION_LABELS[getPositionKey(slot)]}
          </span>
          <span className="text-center text-xs font-semibold text-white">
            {playerLabel ?? "Open slot"}
          </span>
          {slot.player ? (
            <span className="text-[10px] text-white/70">
              {slot.player.position} · {slot.player.club?.shortName ?? ""}
            </span>
          ) : null}
          {slot.player ? (
            <button
              type="button"
              onClick={() => requestStarterChange(slot)}
              disabled={isUpdating || isLocked}
              className="rounded-full border border-white/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 transition hover:border-white disabled:opacity-60"
            >
              Bench
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderBenchSlot = (slot: Slot, index: number) => {
    const canDrag = canDragFromBench(slot);
    return (
      <div
        key={slot.id}
        style={{ animationDelay: `${index * 60}ms` }}
        className="bench-rise flex flex-col justify-between gap-4 rounded-2xl border border-white/30 bg-white/70 p-4 shadow-sm backdrop-blur"
      >
        <div className="flex items-start gap-3">
          <div
            className={`relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/60 text-sm font-semibold text-white shadow-sm transition ${
              slot.player
                ? "bg-white/10"
                : "bg-white/20 text-emerald-900"
            } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
            draggable={canDrag}
            onDragStart={(event) => handleDragStart(event, slot)}
            onDragEnd={handleDragEnd}
          >
            {slot.player ? (
              <>
                {getKitSrc(slot) ? (
                  <img
                    src={getKitSrc(slot) ?? ""}
                    alt={slot.player.club?.shortName ?? "Club kit"}
                    className="h-10 w-10 object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-white">#</span>
                )}
                {slot.player.jerseyNumber != null ? (
                  <span className="absolute bottom-[-4px] right-[-4px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-emerald-950 shadow-sm">
                    {slot.player.jerseyNumber}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-semibold text-emerald-900">#</span>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            {slot.player ? (
              <>
                <p className="text-sm font-semibold text-emerald-950">
                  {slot.player.name}
                </p>
                <p className="text-xs text-emerald-800/80">
                  {slot.player.position} · {slot.player.club?.shortName ?? ""}
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">
                Open bench slot
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          {slot.player ? null : (
            <Link
              href={`/leagues/${leagueId}/players`}
              className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900 transition hover:border-emerald-300"
            >
              Add player
            </Link>
          )}
          {slot.player ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => requestStarterChange(slot)}
                disabled={isUpdating || isLocked}
                className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900 transition hover:border-emerald-300 disabled:opacity-60"
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => clearSlot(slot)}
                disabled={isUpdating || isLocked}
                className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900 transition hover:border-emerald-300 disabled:opacity-60"
              >
                Drop
              </button>
            </div>
          ) : null}
        </div>
      </div>
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
      <div className="pitch-enter rounded-[32px] border border-emerald-950/20 bg-[linear-gradient(180deg,#1f5e2c_0%,#17401f_100%)] p-6 shadow-[0_20px_60px_rgba(4,33,18,0.25)]">
          <div className="relative aspect-[1/2] max-h-[900px] w-full overflow-hidden rounded-[26px] border border-white/50">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08)_32px,rgba(255,255,255,0.02)_32px,rgba(255,255,255,0.02)_64px)]" />
            <div className="absolute inset-4 rounded-[22px] border-2 border-white/60" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
            <div className="absolute left-1/2 top-4 h-16 w-36 -translate-x-1/2 rounded-b-[18px] border-2 border-white/60" />
            <div className="absolute left-1/2 bottom-4 h-16 w-36 -translate-x-1/2 rounded-t-[18px] border-2 border-white/60" />
            <div className="relative z-10 flex h-full flex-col justify-between px-4 py-6">
              {["FWD", "MID", "DEF", "GK"].map((key) => (
                <div key={key} className="flex flex-col gap-3">
                  <div className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                    {POSITION_LABELS[key as PositionKey]}
                  </div>
                  <div className="grid grid-flow-col auto-cols-fr items-start justify-items-center gap-3">
                    {(startersByPosition[key as PositionKey] ?? []).length > 0
                      ? startersByPosition[key as PositionKey].map(renderPitchSlot)
                      : null}
                    {(startersByPosition[key as PositionKey] ?? []).length === 0 ? (
                      <div className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                        No starters
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {updateError ? (
            <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
              {updateError}
            </div>
          ) : null}

          <div className="mt-6 rounded-[26px] border border-white/40 bg-[linear-gradient(135deg,rgba(134,239,172,0.7),rgba(56,189,248,0.6))] p-5 shadow-[0_16px_40px_rgba(7,40,32,0.25)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-950">
                  Bench
                </p>
                <p className="text-xs text-emerald-900/80">
                  Drag a bench player onto a starter to swap.
                </p>
              </div>
              <span className="rounded-full bg-emerald-950/10 px-3 py-1 text-xs font-semibold text-emerald-950">
                {bench.length} slots
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {bench.map((slot, index) => renderBenchSlot(slot, index))}
            </div>
          </div>
      </div>
    </div>
  );
}
