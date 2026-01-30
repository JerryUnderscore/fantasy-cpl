"use client";

import Image from "next/image";
import { useMemo } from "react";
import { getClubDisplayName } from "@/lib/clubs";
import { getKitSrc } from "@/lib/kits";

type SlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  } | null;
};

type Props = {
  starters: SlotView[];
  bench: SlotView[];
  showKits?: boolean;
};

const buildRosterLabel = (player: NonNullable<SlotView["player"]>) =>
  `${player.position} · ${
    player.club ? getClubDisplayName(player.club.slug, player.club.name) : ""
  }`.trim();

export default function TradeRosterClient({
  starters,
  bench,
  showKits = false,
}: Props) {
  const sortedStarters = useMemo(
    () => [...starters].sort((a, b) => a.slotNumber - b.slotNumber),
    [starters],
  );
  const sortedBench = useMemo(
    () => [...bench].sort((a, b) => a.slotNumber - b.slotNumber),
    [bench],
  );

  const renderSlot = (slot: SlotView) => {
    const kitSrc = slot.player ? getKitSrc(slot.player.club?.slug) : null;

    return (
      <li
        key={slot.id}
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          {showKits && slot.player ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface2)]">
              {kitSrc ? (
                <Image
                  src={kitSrc}
                  alt={slot.player.club?.shortName ?? "Club kit"}
                  width={28}
                  height={28}
                />
              ) : (
                <span className="text-xs text-[var(--text-muted)]">—</span>
              )}
            </div>
          ) : null}
          <div className="flex flex-col">
            {slot.player ? (
              <p className="text-base font-semibold text-[var(--text)]">
                {slot.player.jerseyNumber != null
                  ? `${slot.player.name} (${slot.player.jerseyNumber})`
                  : slot.player.name}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Empty slot</p>
            )}
            {slot.player ? (
              <p className="text-sm text-[var(--text-muted)]">
                {buildRosterLabel(slot.player)}
              </p>
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Starters ({sortedStarters.length}/11)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {sortedStarters.map(renderSlot)}
            {sortedStarters.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                No starters selected yet.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Bench ({sortedBench.length}/4)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {sortedBench.map(renderSlot)}
          </ul>
        </div>
      </div>
    </>
  );
}
