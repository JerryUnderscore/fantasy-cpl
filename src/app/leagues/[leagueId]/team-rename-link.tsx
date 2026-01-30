"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TeamRenameLinkProps = {
  leagueId: string;
  initialTeamName: string;
};

export default function TeamRenameLink({
  leagueId,
  initialTeamName,
}: TeamRenameLinkProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialTeamName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);

    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/team/name`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Unable to rename team");
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
      >
        Rename
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Rename team
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Update your team name for this league.
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            {error ? (
              <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="rounded-full bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--background)] disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
