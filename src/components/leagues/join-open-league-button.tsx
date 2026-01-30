"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type JoinOpenLeagueButtonProps = {
  leagueId: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  onJoined?: () => void;
};

export default function JoinOpenLeagueButton({
  leagueId,
  label = "Join",
  disabled = false,
  className = "",
  onJoined,
}: JoinOpenLeagueButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleJoin = () => {
    if (disabled || isPending) return;
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

      onJoined?.();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleJoin}
        disabled={disabled || isPending}
        className={`rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {isPending ? "Joining..." : label}
      </button>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
