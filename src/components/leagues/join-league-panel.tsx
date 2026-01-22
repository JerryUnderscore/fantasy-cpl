"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CODE_MIN_LENGTH = 4;

export default function JoinLeaguePanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const validateCode = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length < CODE_MIN_LENGTH) {
      return "Invite code seems too short.";
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    const normalized = code.trim().toUpperCase();
    const validationError = validateCode(code);
    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: normalized }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to join league");
      }

      setCode("");
      setSuccess("League joined. Refreshing…");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join league");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Join a league
        </p>
        <span className="text-xs text-[var(--accent)]">Invite code</span>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter invite code"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] uppercase tracking-[0.3em]"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed"
          >
            {pending ? "Joining…" : "Join league"}
          </button>
        </div>
        {error ? (
          <p className="text-xs text-[var(--danger)]">{error}</p>
        ) : success ? (
          <p className="text-xs text-[var(--success)]">{success}</p>
        ) : null}
      </form>
    </div>
  );
}
