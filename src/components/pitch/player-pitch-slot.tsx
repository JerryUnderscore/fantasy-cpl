"use client";

import Image from "next/image";

const getKitSrc = (slug?: string | null) =>
  slug ? `/kits/${slug}.svg` : null;

export type PlayerPitchSlotProps = {
  playerName?: string | null;
  position?: string | null;
  clubName?: string | null;
  clubSlug?: string | null;
  jerseyNumber?: number | null;
};

export default function PlayerPitchSlot({
  playerName,
  position,
  clubName,
  clubSlug,
  jerseyNumber,
}: PlayerPitchSlotProps) {
  const displayName = playerName ?? "Open slot";
  const kitSrc = getKitSrc(clubSlug);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-[18px] border-2 shadow-sm transition ${
          kitSrc ? "border-white/70 bg-white/10" : "border-white/50 border-dashed bg-white/10"
        }`}
      >
        {kitSrc ? (
          <Image
            src={kitSrc}
            alt={clubName ? `${clubName} kit` : "Club kit"}
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority={false}
          />
        ) : (
          <span className="text-lg font-semibold text-white">#</span>
        )}
        {jerseyNumber != null ? (
          <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-emerald-950 shadow-sm">
            {jerseyNumber}
          </span>
        ) : null}
      </div>

      <span className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
        {position ?? "Player"}
      </span>

      <span className="text-center text-sm font-semibold text-white">
        {displayName}
      </span>

      {clubName ? (
        <span className="text-[10px] text-white/70">
          {clubName}
        </span>
      ) : null}
    </div>
  );
}
