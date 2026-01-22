"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { getClubDisplayName } from "@/lib/clubs";
import LineupPitch, {
  POSITION_KEYS,
  type PositionKey,
} from "@/components/lineup-pitch";
import PlayerPitchSlot from "@/components/pitch/player-pitch-slot";

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

const getKitSrc = (slot: Slot) =>
  slot.player?.club?.slug ? `/kits/${slot.player.club.slug}.svg` : null;

const buildSlotClubName = (club: Slot["player"]["club"] | null) =>
  club?.slug ? getClubDisplayName(club.slug, club.shortName ?? null) : null;

const getPositionKey = (slot: Slot): PositionKey => {
  const candidate = slot.position || slot.player?.position || "MID";
  return POSITION_KEYS.includes(candidate as PositionKey)
    ? (candidate as PositionKey)
    : "MID";
};

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
        className={`flex w-full max-w-[160px] flex-col items-center gap-3 rounded-2xl px-2 py-3 transition ${
          isDropTarget
            ? "bg-white/20 ring-2 ring-amber-200"
            : "bg-transparent"
        } ${canDrop ? "cursor-copy" : ""}`}
      >
        <PlayerPitchSlot
          playerName={slot.player?.name ?? "Open slot"}
          position={slot.player?.position ?? "Player"}
          clubName={slot.player ? buildSlotClubName(slot.player.club) : null}
          clubSlug={slot.player?.club?.slug ?? null}
          jerseyNumber={slot.player?.jerseyNumber ?? null}
        />
        <div className="flex flex-col items-center gap-2">
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
    const kitSrc = getKitSrc(slot);
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
              {kitSrc ? (
                <Image
                  src={kitSrc}
                  alt={slot.player.club?.shortName ?? "Club kit"}
                  width={40}
                  height={40}
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
      <LineupPitch
        startersByPosition={startersByPosition}
        bench={bench}
        renderPitchSlot={renderPitchSlot}
        renderBenchSlot={renderBenchSlot}
        benchDescription="Drag a bench player onto a starter to swap."
        benchCountLabel={(count) => (
          <span className="rounded-full bg-emerald-950/10 px-3 py-1 text-xs font-semibold text-emerald-950">
            {count} slots
          </span>
        )}
        errorMessage={updateError}
      />
    </div>
  );
}
