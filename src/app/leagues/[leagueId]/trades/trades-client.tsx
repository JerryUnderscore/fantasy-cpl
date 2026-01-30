"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPlayerName } from "@/lib/players";
import TradeOfferModal from "./trade-offer-modal";
import { getClubDisplayName } from "@/lib/clubs";
import LoadingState from "@/components/layout/loading-state";
import InlineError from "@/components/layout/inline-error";
import EmptyState from "@/components/layout/empty-state";
import SectionCard from "@/components/layout/section-card";
import TradeCard, {
  type TradeCardStatus,
  type TradeItem as TradeCardItem,
} from "@/components/trades/trade-card";
import { useSheet } from "@/components/overlays/sheet-provider";
import { useToast } from "@/components/overlays/toast-provider";

type TradePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
  club: { shortName: string | null; slug: string; name: string } | null;
};

type TradeLineItem = {
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
  items: TradeLineItem[];
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
  const [actingTradeId, setActingTradeId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"inbox" | "sent" | "history">(
    "inbox",
  );
  const sheet = useSheet();
  const toast = useToast();

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
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? payload.error ?? "Failed to load trades"
            : "Failed to load trades",
        );
      }
      if (!payload || !("trades" in payload) || !("teamId" in payload)) {
        throw new Error("Failed to load trades");
      }
      setTrades(payload.trades ?? []);
      setTeamId(payload.teamId ?? null);
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
  const historyTrades = useMemo(
    () => trades.filter((trade) => trade.status !== "PENDING"),
    [trades],
  );

  const handleTradeActionInSheet = async (
    tradeId: string,
    action: string,
  ) => {
    setActingTradeId(tradeId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          ok: false,
          message: payload?.error ?? "Unable to update trade",
          status: res.status,
        } as const;
      }
      await loadTrades();
      return { ok: true } as const;
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Unable to update trade",
        status: 500,
      } as const;
    } finally {
      setActingTradeId(null);
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
      throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? payload.error ?? "Unable to load roster"
          : "Unable to load roster",
      );
    }
    if (!payload || !("team" in payload) || !("players" in payload)) {
      throw new Error("Unable to load roster");
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
      <LoadingState label="Loading trades..." />
    );
  }

  const mapStatus = (trade: Trade): { status: TradeCardStatus; label: string } => {
    switch (trade.status) {
      case "PENDING":
        return { status: "PENDING", label: "Pending" };
      case "ACCEPTED":
        return { status: "ACCEPTED", label: "Accepted" };
      case "DECLINED":
        return { status: "REJECTED", label: "Rejected" };
      case "CANCELED":
        return { status: "EXPIRED", label: "Withdrawn" };
      case "COUNTERED":
        return { status: "EXPIRED", label: "Countered" };
      default:
        return { status: "EXPIRED", label: trade.status };
    }
  };

  const renderTradeCard = (
    trade: Trade,
    direction: "INCOMING" | "OUTGOING" | "HISTORY",
    leftItems: TradeCardItem[],
    rightItems: TradeCardItem[],
    leftLabel?: string,
    rightLabel?: string,
    options?: { collapsible?: boolean; stacked?: boolean; stackedOrder?: "left-first" | "right-first" },
  ) => {
    const { status, label } = mapStatus(trade);

    return (
      <TradeCard
        key={trade.id}
        direction={direction}
        status={status}
        statusLabel={label}
        title={`${trade.offeredByTeam.name} -> ${trade.offeredToTeam.name}`}
        subtext={`${trade.offeredByTeam.profile?.displayName ?? "Unknown"} - ${
          trade.offeredToTeam.profile?.displayName ?? "Unknown"
        }`}
        timestamp={trade.createdAt}
        leftItems={leftItems}
        rightItems={rightItems}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        onAccept={
          direction === "INCOMING" && status === "PENDING"
            ? () =>
                sheet.open({
                  id: `trade-accept-${trade.id}`,
                  title: "Accept trade?",
                  subtitle: "You can’t undo this once accepted.",
                  render: () => (
                    <p className="text-sm text-[var(--text-muted)]">
                      Confirm accepting this trade.
                    </p>
                  ),
                  actions: [
                    { key: "cancel", label: "Cancel", tone: "secondary" },
                    {
                      key: "confirm",
                      label: "Accept trade",
                      tone: "primary",
                      onPress: async (ctx) => {
                        const result = await handleTradeActionInSheet(
                          trade.id,
                          "ACCEPT",
                        );
                        if (!result.ok) {
                          ctx.setError(result.message);
                          return;
                        }
                        toast.success("Trade accepted.");
                        ctx.close({ type: "action", payload: { key: "confirm" } });
                      },
                      autoClose: false,
                    },
                  ],
                })
            : undefined
        }
        onReject={
          direction === "INCOMING" && status === "PENDING"
            ? () =>
                sheet.open({
                  id: `trade-decline-${trade.id}`,
                  title: "Reject trade?",
                  subtitle: "This offer will be declined.",
                  render: () => (
                    <p className="text-sm text-[var(--text-muted)]">
                      Confirm rejecting this trade.
                    </p>
                  ),
                  actions: [
                    { key: "cancel", label: "Cancel", tone: "secondary" },
                    {
                      key: "confirm",
                      label: "Reject trade",
                      tone: "danger",
                      onPress: async (ctx) => {
                        const result = await handleTradeActionInSheet(
                          trade.id,
                          "DECLINE",
                        );
                        if (!result.ok) {
                          ctx.setError(result.message);
                          return;
                        }
                        toast.info("Trade rejected.");
                        ctx.close({ type: "action", payload: { key: "confirm" } });
                      },
                      autoClose: false,
                    },
                  ],
                })
            : undefined
        }
        onCounter={
          direction === "INCOMING" && status === "PENDING"
            ? () => openCounterModal(trade)
            : undefined
        }
        onWithdraw={
          direction === "OUTGOING" && status === "PENDING"
            ? () =>
                sheet.open({
                  id: `trade-withdraw-${trade.id}`,
                  title: "Withdraw trade?",
                  subtitle: "This offer will be pulled back.",
                  render: () => (
                    <p className="text-sm text-[var(--text-muted)]">
                      Confirm withdrawing this trade offer.
                    </p>
                  ),
                  actions: [
                    { key: "cancel", label: "Cancel", tone: "secondary" },
                    {
                      key: "confirm",
                      label: "Withdraw trade",
                      tone: "danger",
                      onPress: async (ctx) => {
                        const result = await handleTradeActionInSheet(
                          trade.id,
                          "CANCEL",
                        );
                        if (!result.ok) {
                          ctx.setError(result.message);
                          return;
                        }
                        toast.info("Trade withdrawn.");
                        ctx.close({ type: "action", payload: { key: "confirm" } });
                      },
                      autoClose: false,
                    },
                  ],
                })
            : undefined
        }
        isActing={actingTradeId === trade.id}
        actionsDisabled={actingTradeId === trade.id}
        collapsible={options?.collapsible}
        defaultCollapsed={options?.collapsible}
        stacked={options?.stacked}
        stackedOrder={options?.stackedOrder}
      />
    );
  };

  const buildTradeItemsFromPlayers = (items: TradePlayer[]): TradeCardItem[] =>
    items.map((item) => ({
      id: item.id,
      name: formatPlayerName(item.name, item.jerseyNumber),
      position: item.position,
      clubName: item.club
        ? getClubDisplayName(item.club.slug, item.club.name)
        : null,
      clubSlug: item.club?.slug ?? null,
    }));

  const incomingPending = pendingTrades.filter(
    (trade) => trade.offeredToTeamId === teamId,
  );
  const outgoingPending = pendingTrades.filter(
    (trade) => trade.offeredByTeamId === teamId,
  );

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <InlineError message={error} />
      ) : null}

      <div className="flex flex-col gap-4 sm:hidden">
        <div className="flex w-full rounded-full border border-[var(--border)] bg-[var(--surface2)] p-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {[
            { key: "inbox", label: `Inbox (${incomingPending.length})` },
            { key: "sent", label: `Sent (${outgoingPending.length})` },
            { key: "history", label: `History (${historyTrades.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                setMobileTab(tab.key as "inbox" | "sent" | "history")
              }
              className={`flex-1 rounded-full px-3 py-2 text-[11px] ${
                mobileTab === tab.key
                  ? "bg-[var(--surface)] text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {mobileTab === "inbox" ? (
          incomingPending.length === 0 ? (
            <EmptyState
              title="No trade offers yet"
              description="This is where you'll review and respond to trade offers sent to you."
            />
          ) : (
            <div className="grid gap-4">
              {incomingPending.map((trade) => {
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );

                return renderTradeCard(
                  trade,
                  "INCOMING",
                  buildTradeItemsFromPlayers(
                    requestedPlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    offeredPlayers.map((item) => item.player),
                  ),
                  undefined,
                  undefined,
                  { collapsible: true, stacked: true, stackedOrder: "right-first" },
                );
              })}
            </div>
          )
        ) : null}
        {mobileTab === "sent" ? (
          outgoingPending.length === 0 ? (
            <EmptyState
              title="No sent trades"
              description="You have not sent any trade offers yet."
            />
          ) : (
            <div className="grid gap-4">
              {outgoingPending.map((trade) => {
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );

                return renderTradeCard(
                  trade,
                  "OUTGOING",
                  buildTradeItemsFromPlayers(
                    offeredPlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    requestedPlayers.map((item) => item.player),
                  ),
                  undefined,
                  undefined,
                  { collapsible: true, stacked: true, stackedOrder: "left-first" },
                );
              })}
            </div>
          )
        ) : null}
        {mobileTab === "history" ? (
          historyTrades.length === 0 ? (
            <EmptyState
              title="No trade history"
              description="No completed trades yet."
            />
          ) : (
            <div className="grid gap-4">
              {historyTrades.map((trade) => {
                const isIncoming = trade.offeredToTeamId === teamId;
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );
                const gavePlayers = isIncoming ? requestedPlayers : offeredPlayers;
                const receivedPlayers = isIncoming ? offeredPlayers : requestedPlayers;

                return renderTradeCard(
                  trade,
                  "HISTORY",
                  buildTradeItemsFromPlayers(
                    gavePlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    receivedPlayers.map((item) => item.player),
                  ),
                  undefined,
                  undefined,
                  { collapsible: true, stacked: true, stackedOrder: "right-first" },
                );
              })}
            </div>
          )
        ) : null}
      </div>

      <div className="hidden flex-col gap-6 sm:flex">
        <SectionCard
          title="Trade Inbox"
          description="Review and respond to incoming offers."
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {incomingPending.length} pending
            </span>
          }
        >
          {incomingPending.length === 0 ? (
            <EmptyState
              title="No trade offers yet"
              description="This is where you'll review and respond to trade offers sent to you."
            />
          ) : (
            <div className="grid gap-4">
              {incomingPending.map((trade) => {
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );

                return renderTradeCard(
                  trade,
                  "INCOMING",
                  buildTradeItemsFromPlayers(
                    requestedPlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    offeredPlayers.map((item) => item.player),
                  ),
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Sent Trades"
          description="Offers you have sent that are awaiting a response."
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {outgoingPending.length} pending
            </span>
          }
        >
          {outgoingPending.length === 0 ? (
            <EmptyState
              title="No sent trades"
              description="You have not sent any trade offers yet."
            />
          ) : (
            <div className="grid gap-4">
              {outgoingPending.map((trade) => {
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );

                return renderTradeCard(
                  trade,
                  "OUTGOING",
                  buildTradeItemsFromPlayers(
                    offeredPlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    requestedPlayers.map((item) => item.player),
                  ),
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Trade History"
          description="Completed or resolved trades from this season."
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {historyTrades.length} recorded
            </span>
          }
        >
          {historyTrades.length === 0 ? (
            <EmptyState
              title="No trade history"
              description="No completed trades yet."
            />
          ) : (
            <div className="grid gap-4">
              {historyTrades.map((trade) => {
                const isIncoming = trade.offeredToTeamId === teamId;
                const offeredPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_OFFERING",
                );
                const requestedPlayers = trade.items.filter(
                  (item) => item.direction === "FROM_RECEIVING",
                );
                const gavePlayers = isIncoming ? requestedPlayers : offeredPlayers;
                const receivedPlayers = isIncoming ? offeredPlayers : requestedPlayers;

                return renderTradeCard(
                  trade,
                  "HISTORY",
                  buildTradeItemsFromPlayers(
                    gavePlayers.map((item) => item.player),
                  ),
                  buildTradeItemsFromPlayers(
                    receivedPlayers.map((item) => item.player),
                  ),
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

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
