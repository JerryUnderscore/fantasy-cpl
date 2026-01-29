"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPlayerName } from "@/lib/players";
import TradeOfferModal from "./trade-offer-modal";
import { getClubDisplayName } from "@/lib/clubs";
import LoadingState from "@/components/layout/loading-state";
import InlineError from "@/components/layout/inline-error";
import EmptyState from "@/components/layout/empty-state";

type TradePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: { shortName: string | null; slug: string; name: string } | null;
};

type TradeItem = {
  id: string;
  direction: "FROM_OFFERING" | "FROM_RECEIVING";
  player: TradePlayer;
};

type TradeTeam = {
  id: string;
  name: string;
  profile: { displayName: string | null } | null;
};

type Trade = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED" | "COUNTERED";
  parentTradeId: string | null;
  createdAt: string;
  offeredByTeamId: string;
  offeredToTeamId: string;
  offeredByTeam: TradeTeam;
  offeredToTeam: TradeTeam;
  items: TradeItem[];
};

type TradesResponse = {
  teamId: string;
  trades: Trade[];
};

type TeamRosterResponse = {
  team: { id: string; name: string };
  players: TradePlayer[];
};

type CounterModalState = {
  tradeId: string;
  offeredToTeam: { id: string; name: string };
  offeredByTeam: { id: string; name: string };
  offeringPlayers: TradePlayer[];
  receivingPlayers: TradePlayer[];
  initialSendPlayerIds: string[];
  initialReceivePlayerIds: string[];
};

export default function TradesClient({ leagueId }: { leagueId: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<CounterModalState | null>(null);

  const loadTrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/trades`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        | TradesResponse
        | { error?: string }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load trades");
      }
      setTrades(payload?.trades ?? []);
      setTeamId(payload?.teamId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trades");
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

  const pendingTrades = useMemo(
    () => trades.filter((trade) => trade.status === "PENDING"),
    [trades],
  );

  const buildRosterLabel = (player: TradePlayer) =>
    `${player.position} · ${
      player.club ? getClubDisplayName(player.club.slug, player.club.name) : ""
    }`.trim();

  const handleTradeAction = async (tradeId: string, action: string) => {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/trades/${tradeId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to update trade");
      }
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update trade");
    }
  };

  const loadRoster = async (teamId: string) => {
    const res = await fetch(
      `/api/leagues/${leagueId}/teams/${teamId}/roster`,
      { cache: "no-store" },
    );
    const payload = (await res.json().catch(() => null)) as
      | TeamRosterResponse
      | { error?: string }
      | null;
    if (!res.ok) {
      throw new Error(payload?.error ?? "Unable to load roster");
    }
    return payload;
  };

  const openCounterModal = async (trade: Trade) => {
    if (!teamId) return;
    setError(null);

    try {
      const [myRoster, theirRoster] = await Promise.all([
        loadRoster(teamId),
        loadRoster(trade.offeredByTeamId),
      ]);

      const initialReceivePlayerIds = trade.items
        .filter((item) => item.direction === "FROM_OFFERING")
        .map((item) => item.player.id);
      const initialSendPlayerIds = trade.items
        .filter((item) => item.direction === "FROM_RECEIVING")
        .map((item) => item.player.id);

      setModalState({
        tradeId: trade.id,
        offeredToTeam: trade.offeredByTeam,
        offeredByTeam: myRoster.team,
        offeringPlayers: myRoster.players,
        receivingPlayers: theirRoster.players,
        initialSendPlayerIds,
        initialReceivePlayerIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load rosters");
    }
  };

  if (isLoading) {
    return (
      <LoadingState label="Loading trades…" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <InlineError message={error} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            Pending offers
          </p>
          <p className="text-xs text-zinc-500">
            Trades awaiting a response.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {pendingTrades.length} pending
        </span>
      </div>

      {trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          description="Trades let you exchange players with other teams."
        />
      ) : (
        <div className="grid gap-4">
          {trades.map((trade) => {
            const isIncoming = trade.offeredToTeamId === teamId;
            const offeredPlayers = trade.items.filter(
              (item) => item.direction === "FROM_OFFERING",
            );
            const requestedPlayers = trade.items.filter(
              (item) => item.direction === "FROM_RECEIVING",
            );

            return (
              <div
                key={trade.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {trade.status}
                    </p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {trade.offeredByTeam.name} → {trade.offeredToTeam.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {trade.offeredByTeam.profile?.displayName ?? "Unknown"} · {" "}
                      {trade.offeredToTeam.profile?.displayName ?? "Unknown"}
                    </p>
                  </div>
                  {trade.status === "PENDING" ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Pending
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {trade.status}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {trade.offeredByTeam.name} sends
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                      {offeredPlayers.map((item) => (
                        <li key={item.id}>
                          <span className="font-semibold text-zinc-900">
                            {formatPlayerName(
                              item.player.name,
                              item.player.jerseyNumber,
                            )}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {" "}· {buildRosterLabel(item.player)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {trade.offeredToTeam.name} sends
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                      {requestedPlayers.map((item) => (
                        <li key={item.id}>
                          <span className="font-semibold text-zinc-900">
                            {formatPlayerName(
                              item.player.name,
                              item.player.jerseyNumber,
                            )}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {" "}· {buildRosterLabel(item.player)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {trade.status === "PENDING" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isIncoming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTradeAction(trade.id, "ACCEPT")}
                          className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTradeAction(trade.id, "DECLINE")}
                          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => openCounterModal(trade)}
                          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                        >
                          Counter
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTradeAction(trade.id, "CANCEL")}
                        className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {modalState ? (
        <TradeOfferModal
          open
          leagueId={leagueId}
          offeredByTeam={modalState.offeredByTeam}
          offeredToTeam={modalState.offeredToTeam}
          offeringPlayers={modalState.offeringPlayers}
          receivingPlayers={modalState.receivingPlayers}
          parentTradeId={modalState.tradeId}
          initialSendPlayerIds={modalState.initialSendPlayerIds}
          initialReceivePlayerIds={modalState.initialReceivePlayerIds}
          onClose={() => setModalState(null)}
          onSubmitted={() => {
            setModalState(null);
            void loadTrades();
          }}
        />
      ) : null}
    </div>
  );
}
