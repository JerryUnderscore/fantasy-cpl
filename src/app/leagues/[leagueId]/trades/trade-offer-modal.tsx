"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";

type TradePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: { shortName: string | null } | null;
};

type TradeTeam = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  leagueId: string;
  offeredByTeam: TradeTeam;
  offeredToTeam: TradeTeam;
  offeringPlayers: TradePlayer[];
  receivingPlayers: TradePlayer[];
  parentTradeId?: string | null;
  initialSendPlayerIds?: string[];
  initialReceivePlayerIds?: string[];
  onClose: () => void;
  onSubmitted?: () => void;
};

const buildPlayerLabel = (player: TradePlayer) =>
  `${player.position} · ${
    player.club ? getClubDisplayName(player.club.slug, null) : ""
  }`.trim();

export default function TradeOfferModal({
  open,
  leagueId,
  offeredByTeam,
  offeredToTeam,
  offeringPlayers,
  receivingPlayers,
  parentTradeId,
  initialSendPlayerIds,
  initialReceivePlayerIds,
  onClose,
  onSubmitted,
}: Props) {
  const [selectedSendIds, setSelectedSendIds] = useState<string[]>([]);
  const [selectedReceiveIds, setSelectedReceiveIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedSendIds(initialSendPlayerIds ?? []);
    setSelectedReceiveIds(initialReceivePlayerIds ?? []);
    setError(null);
  }, [open, initialSendPlayerIds, initialReceivePlayerIds]);

  const countMismatch = selectedSendIds.length !== selectedReceiveIds.length;
  const canSubmit =
    selectedSendIds.length > 0 &&
    selectedReceiveIds.length > 0 &&
    !countMismatch &&
    !isSubmitting;

  const toggleSelected = (
    list: string[],
    id: string,
    setList: (value: string[]) => void,
  ) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const sendSelection = useMemo(
    () => new Set(selectedSendIds),
    [selectedSendIds],
  );
  const receiveSelection = useMemo(
    () => new Set(selectedReceiveIds),
    [selectedReceiveIds],
  );
  const uniqueOfferingPlayers = useMemo(() => {
    const seen = new Set<string>();
    return offeringPlayers.filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
  }, [offeringPlayers]);
  const uniqueReceivingPlayers = useMemo(() => {
    const seen = new Set<string>();
    return receivingPlayers.filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
  }, [receivingPlayers]);

  const submitOffer = async () => {
    if (!canSubmit) {
      setError("Select the same number of players on each side.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/trades`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offeredToTeamId: offeredToTeam.id,
          sendPlayerIds: selectedSendIds,
          receivePlayerIds: selectedReceiveIds,
          parentTradeId: parentTradeId ?? null,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to submit trade");
      }

      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit trade");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Offer a trade
            </h2>
            <p className="text-sm text-zinc-500">
              Select the same number of players from each team.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-zinc-400 hover:text-zinc-700"
          >
            Close
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {offeredByTeam.name} sends ({selectedSendIds.length})
            </p>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
              <ul className="divide-y divide-zinc-200">
                {uniqueOfferingPlayers.map((player) => (
                  <li key={player.id} className="p-3">
                    <label className="flex items-center gap-3 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={sendSelection.has(player.id)}
                        onChange={() =>
                          toggleSelected(
                            selectedSendIds,
                            player.id,
                            setSelectedSendIds,
                          )
                        }
                      />
                      <span className="flex flex-col">
                        <span className="font-semibold text-zinc-900">
                          {formatPlayerName(player.name, player.jerseyNumber)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {buildPlayerLabel(player)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {uniqueOfferingPlayers.length === 0 ? (
                  <li
                    key="offering-empty"
                    className="p-3 text-sm text-zinc-500"
                  >
                    No rostered players available.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {offeredToTeam.name} sends ({selectedReceiveIds.length})
            </p>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
              <ul className="divide-y divide-zinc-200">
                {uniqueReceivingPlayers.map((player) => (
                  <li key={player.id} className="p-3">
                    <label className="flex items-center gap-3 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={receiveSelection.has(player.id)}
                        onChange={() =>
                          toggleSelected(
                            selectedReceiveIds,
                            player.id,
                            setSelectedReceiveIds,
                          )
                        }
                      />
                      <span className="flex flex-col">
                        <span className="font-semibold text-zinc-900">
                          {formatPlayerName(player.name, player.jerseyNumber)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {buildPlayerLabel(player)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {uniqueReceivingPlayers.length === 0 ? (
                  <li
                    key="receiving-empty"
                    className="p-3 text-sm text-zinc-500"
                  >
                    No rostered players available.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>

        {countMismatch ? (
          <p className="mt-4 text-xs text-amber-600">
            Select the same number of players on each side to continue.
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitOffer}
            disabled={!canSubmit}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
