"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

type Props = {
  leagueId: string;
  initialTeamName: string | null;
};

export default function TeamPanel({ leagueId, initialTeamName }: Props) {
  const [name, setName] = useState(initialTeamName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasTeam = useMemo(() => !!initialTeamName, [initialTeamName]);

  const submit = () => {
    setError(null);

    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/team`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong");
        return;
      }

      // simplest refresh: reload route data
      window.location.reload();
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-zinc-900">Your team</p>

        {!hasTeam ? (
          <>
            <p className="text-sm text-zinc-600">
              You haven’t created a team yet.
            </p>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Team name"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              <button
                onClick={submit}
                disabled={isPending}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Creating…" : "Create team"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600">{initialTeamName}</p>
            <Link
              href={`/leagues/${leagueId}/team`}
              className="text-xs font-semibold uppercase tracking-wide text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              View roster
            </Link>
          </>
        )}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <p className="mt-1 text-xs text-zinc-500">
          One team per league. You can rename anytime.
        </p>
      </div>
    </div>
  );
}
