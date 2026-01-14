"use client";

import { useMemo, useState, useTransition } from "react";

type OnTheClock = {
  fantasyTeamId: string;
  name: string;
  pickNumber: number;
  round: number;
  slotInRound: number;
};

type Pick = {
  id: string;
  pickNumber: number;
  round: number;
  slotInRound: number;
  teamName: string;
  player: { name: string; position: string; club: string | null };
};

type AvailablePlayer = {
  id: string;
  name: string;
  position: string;
  club: string | null;
};

type Props = {
  leagueId: string;
  isOwner: boolean;
  draftStatus: "NOT_STARTED" | "LIVE" | "COMPLETE";
  onTheClock: OnTheClock | null;
  picks: Pick[];
  availablePlayers: AvailablePlayer[];
  canPick: boolean;
};

export default function DraftClient({
  leagueId,
  isOwner,
  draftStatus,
  onTheClock,
  picks,
  availablePlayers,
  canPick,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusLabel = useMemo(() => {
    if (draftStatus === "NOT_STARTED") return "Not started";
    if (draftStatus === "LIVE") return "Live";
    return "Complete";
  }, [draftStatus]);

  const startDraft = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/draft/start`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to start draft");
        return;
      }
      window.location.reload();
    });
  };

  const makePick = (playerId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/draft/pick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to draft player");
        return;
      }
      window.location.reload();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-900">Draft status</p>
          <p className="text-sm text-zinc-600">{statusLabel}</p>
          <p className="text-sm text-zinc-600">
            On the clock: {onTheClock ? onTheClock.name : "—"}
          </p>
          {onTheClock ? (
            <p className="text-xs text-zinc-500">
              Pick {onTheClock.pickNumber} · Round {onTheClock.round} · Slot{" "}
              {onTheClock.slotInRound}
            </p>
          ) : null}

          {draftStatus === "NOT_STARTED" ? (
            isOwner ? (
              <button
                onClick={startDraft}
                disabled={isPending}
                className="mt-3 w-fit rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Starting…" : "Start draft"}
              </button>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                Waiting for the owner to start the draft.
              </p>
            )
          ) : null}

          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Picks
        </h2>
        {picks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No picks yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {picks.map((pick) => (
              <li
                key={pick.id}
                className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Pick {pick.pickNumber} · Round {pick.round}
                  </p>
                  <p className="text-xs text-zinc-500">{pick.teamName}</p>
                </div>
                <p className="text-base font-semibold text-zinc-900">
                  {pick.player.name}
                </p>
                <p className="text-sm text-zinc-500">
                  {pick.player.position} · {pick.player.club ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Available players
        </h2>
        {availablePlayers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No available players.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {availablePlayers.map((player) => (
              <li
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-col">
                  <p className="text-base font-semibold text-zinc-900">
                    {player.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {player.position} · {player.club ?? "—"}
                  </p>
                </div>
                <button
                  onClick={() => makePick(player.id)}
                  disabled={!canPick || isPending}
                  className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isPending ? "Drafting…" : "Draft"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!canPick && draftStatus === "LIVE" ? (
          <p className="mt-3 text-xs text-zinc-500">
            You can draft when your team is on the clock.
          </p>
        ) : null}
      </div>
    </div>
  );
}
