import Link from "next/link";

export default function CreateLeaguePanel() {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Create a league
        </p>
        <span className="text-xs text-[var(--text-muted)]">New</span>
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Customize your league settings, schedule, and invite friends.
      </p>

      <Link
        href="/leagues/create"
        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[var(--accent-muted)] relative z-10"
      >
        <span className="inline-block text-black">Create league</span>
      </Link>
    </div>
  );
}
