"use client";

import Image from "next/image";
import LineupPitch from "@/components/lineup-pitch";
import PlayerPitchSlot from "@/components/pitch/player-pitch-slot";
import type { PositionKey } from "@/lib/lineup-positions";
import { getKitSrc } from "@/lib/kits";
import React from "react";

export type StaticSlot = {
  id: string;
  name: string;
  clubName: string | null;
  clubSlug: string | null;
  position: string;
  jerseyNumber: number | null;
};

type Props = {
  startersByPosition: Record<PositionKey, StaticSlot[]>;
  bench: StaticSlot[];
  benchDescription?: React.ReactNode;
};

export default function LandingLineup({
  startersByPosition,
  bench,
  benchDescription,
}: Props) {
  const renderPitchSlot = (slot: StaticSlot) => (
    <PlayerPitchSlot
      playerName={slot.name}
      position={slot.position}
      clubName={slot.clubName}
      clubSlug={slot.clubSlug}
      jerseyNumber={slot.jerseyNumber}
    />
  );

  const renderBenchSlot = (slot: StaticSlot) => {
    const kitSrc = getKitSrc(slot.clubSlug);
    return (
      <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-center text-sm text-white">
        <div className="flex items-center justify-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/60 text-sm font-semibold text-white shadow-sm transition bg-white/10">
            {kitSrc ? (
              <Image
                src={kitSrc}
                alt={slot.clubName ?? "Club kit"}
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority={false}
              />
            ) : (
              <span className="text-sm font-semibold text-white">#</span>
            )}
            {slot.jerseyNumber != null ? (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-emerald-950 shadow-sm">
                {slot.jerseyNumber}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">{slot.name}</p>
        <p className="text-xs uppercase tracking-[0.35em] text-white/60">
          {slot.position}
        </p>
        {slot.clubName ? (
          <p className="text-[10px] text-white/60">{slot.clubName}</p>
        ) : null}
      </div>
    );
  };

  return (
    <LineupPitch
      startersByPosition={startersByPosition}
      bench={bench}
      renderPitchSlot={renderPitchSlot}
      renderBenchSlot={renderBenchSlot}
      benchDescription={benchDescription}
    />
  );
}
