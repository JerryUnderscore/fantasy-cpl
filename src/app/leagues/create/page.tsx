import Link from "next/link";
import CreateLeagueForm from "@/components/leagues/create-league-form";

export default function CreateLeaguePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
            Create a league
          </p>
          <h1 className="text-3xl font-semibold text-white">League settings</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Choose the defaults for your league before inviting friends.
          </p>
        </div>

        <div className="mt-6">
          <CreateLeagueForm submitLabel="Create league" />
        </div>

        <div className="mt-6">
          <Link
            href="/leagues"
            className="inline-flex items-center text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            Back to leagues
          </Link>
        </div>
      </div>
    </div>
  );
}
