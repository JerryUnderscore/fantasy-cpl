"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeagueActions() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to create league");
      }

      setCreateName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create league");
    } finally {
      setPending(false);
    }
  };

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to join league");
      }

      setJoinCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join league");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Create a league</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="League name"
            className="flex-1 rounded-2xl border border-zinc-200 px-4 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/50"
          >
            Create
          </button>
        </div>
      </form>

      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Join a league</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="inviteCode"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Invite code"
            className="flex-1 rounded-2xl border border-zinc-200 px-4 py-2 text-sm uppercase tracking-wide"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Join
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
