"use client";

import { useMemo, useState } from "react";
import TradeOfferModal from "../../trades/trade-offer-modal";
import { getClubDisplayName } from "@/lib/clubs";

type SlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null } | null;
  } | null;
};

type TradePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: { shortName: string | null } | null;
};

type Props = {
  leagueId: string;
  allowTrade: boolean;
  targetTeam: { id: string; name: string };
  viewerTeam: { id: string; name: string } | null;
  starters: SlotView[];
  bench: SlotView[];
  viewerPlayers: TradePlayer[];
  targetPlayers: TradePlayer[];
};

const buildRosterLabel = (player: TradePlayer) =>
  `${player.position} · ${
    player.club ? getClubDisplayName(player.club.slug, null) : ""
  }`.trim();

export default function TradeRosterClient({
  leagueId,
  allowTrade,
  targetTeam,
  viewerTeam,
  starters,
  bench,
  viewerPlayers,
  targetPlayers,
}: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sortedStarters = useMemo(
    () => [...starters].sort((a, b) => a.slotNumber - b.slotNumber),
    [starters],
  );
  const sortedBench = useMemo(
    () => [...bench].sort((a, b) => a.slotNumber - b.slotNumber),
    [bench],
  );

  const openOffer = (playerId: string) => {
    if (!allowTrade || !viewerTeam) return;
    setSelectedPlayerId(playerId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPlayerId(null);
  };

  const renderSlot = (slot: SlotView) => (
    <li
      key={slot.id}
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-col">
        {slot.player ? (
          <p className="text-base font-semibold text-zinc-900">
            {slot.player.jerseyNumber != null
              ? `${slot.player.name} (${slot.player.jerseyNumber})`
              : slot.player.name}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Empty slot</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {slot.player ? (
          <p className="text-sm text-zinc-500">
            {buildRosterLabel(slot.player)}
          </p>
        ) : null}
        {allowTrade && slot.player ? (
          <button
            type="button"
            onClick={() => openOffer(slot.player!.id)}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:border-zinc-300"
          >
            Offer trade
          </button>
        ) : null}
      </div>
    </li>
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Starters ({sortedStarters.length}/11)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {sortedStarters.map(renderSlot)}
            {sortedStarters.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                No starters selected yet.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Bench ({sortedBench.length}/4)
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {sortedBench.map(renderSlot)}
          </ul>
        </div>
      </div>

      {modalOpen && viewerTeam ? (
        <TradeOfferModal
          open
          leagueId={leagueId}
          offeredByTeam={viewerTeam}
          offeredToTeam={targetTeam}
          offeringPlayers={viewerPlayers}
          receivingPlayers={targetPlayers}
          initialReceivePlayerIds={selectedPlayerId ? [selectedPlayerId] : []}
          onClose={closeModal}
          onSubmitted={closeModal}
        />
      ) : null}
    </>
  );
}
