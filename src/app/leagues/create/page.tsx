import Link from "next/link";

export default function CreateLeaguePlaceholder() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Create a league
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">League creation coming soon</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          You can still create leagues via the API for now. Reach out to the team if you need help.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            Back to home
          </Link>
        </div>
        <p className="mt-6 text-xs text-[var(--text-muted)]">TODO: Build a create league flow that ships the full settings panel.</p>
      </div>
    </div>
  );
}
