"use client";

import Image from "next/image";
import { getKitSrc } from "@/lib/kits";
import { formatShortName } from "@/lib/players";

type PlayerChipMobileProps = {
  playerName?: string | null;
  clubName?: string | null;
  clubSlug?: string | null;
  badgeLabel?: string | number | null;
};

export default function PlayerChipMobile({
  playerName,
  clubName,
  clubSlug,
  badgeLabel,
}: PlayerChipMobileProps) {
  const kitSrc = getKitSrc(clubSlug);
  const displayName = playerName ? formatShortName(playerName) : "Open slot";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-[16px] border-2 shadow-sm transition ${
          kitSrc ? "border-white/70 bg-white/10" : "border-white/50 border-dashed bg-white/10"
        }`}
      >
        {kitSrc ? (
          <Image
            src={kitSrc}
            alt={clubName ? `${clubName} kit` : "Club kit"}
            width={48}
            height={48}
            className="h-[46px] w-[46px] object-contain"
            priority={false}
          />
        ) : (
          <span className="text-base font-semibold text-white">#</span>
        )}
        {badgeLabel != null ? (
          <span className="absolute -bottom-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-emerald-950 shadow-sm">
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <span className="w-[92%] truncate text-center text-[length:clamp(10px,2.6vw,13px)] font-semibold leading-[1.1] text-white">
        {displayName}
      </span>
    </div>
  );
}
