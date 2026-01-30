"use client";

import { useState } from "react";
import TradeOfferModal from "../../trades/trade-offer-modal";

type TradePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: { shortName: string | null; slug: string; name: string } | null;
};

type TradeTeam = {
  id: string;
  name: string;
};

type TradeOfferActionProps = {
  leagueId: string;
  viewerTeam: TradeTeam | null;
  targetTeam: TradeTeam;
  viewerPlayers: TradePlayer[];
  targetPlayers: TradePlayer[];
  disabled?: boolean;
};

export default function TradeOfferAction({
  leagueId,
  viewerTeam,
  targetTeam,
  viewerPlayers,
  targetPlayers,
  disabled = false,
}: TradeOfferActionProps) {
  const [open, setOpen] = useState(false);

  if (!viewerTeam) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Offer trade
      </button>
      {open ? (
        <TradeOfferModal
          open
          leagueId={leagueId}
          offeredByTeam={viewerTeam}
          offeredToTeam={targetTeam}
          offeringPlayers={viewerPlayers}
          receivingPlayers={targetPlayers}
          onClose={() => setOpen(false)}
          onSubmitted={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
