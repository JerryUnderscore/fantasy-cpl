"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type LeagueSummary = {
  id: string;
  name: string;
  maxTeams: number;
  season: { name: string; year: number };
  _count: { teams: number };
};

type Props = {
  leagues: LeagueSummary[];
};

export default function AvailableLeaguesClient({ leagues }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleJoin = (leagueId: string) => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Unable to join league");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Open leagues
        </h2>
        <p className="text-sm text-zinc-500">
          Join an open league without an invite code.
        </p>
      </div>

      {leagues.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No open leagues right now.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {leagues.map((league) => {
            const isFull = league._count.teams >= league.maxTeams;
            return (
              <li
                key={league.id}
                className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-zinc-900">
                      {league.name}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {league.season.name} · {league.season.year}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoin(league.id)}
                    disabled={isFull || isPending}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFull ? "Full" : "Join"}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Teams: {league._count.teams}/{league.maxTeams}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
