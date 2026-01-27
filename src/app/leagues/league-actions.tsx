"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateLeagueForm from "@/components/leagues/create-league-form";

export default function LeagueActions() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenCreate = () => {
    setError(null);
    setCreateOpen(true);
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
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Create a league</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Choose your league settings before creating.
        </p>
        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={pending}
          className="w-fit rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed"
        >
          Create
        </button>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Join a league</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="inviteCode"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Invite code"
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm uppercase tracking-wide text-[var(--text)] placeholder:text-[var(--text-muted)]"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Join
          </button>
        </div>
      </form>

      {error && !createOpen ? (
        <p className="rounded-2xl border border-red-600 bg-[var(--surface2)] px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  League settings
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Pick your defaults before creating the league.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
                className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <CreateLeagueForm
                onCreated={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
