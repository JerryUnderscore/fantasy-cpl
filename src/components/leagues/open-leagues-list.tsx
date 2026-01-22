import Link from "next/link";
import type { OpenLeagueViewModel } from "./types";

type OpenLeaguesListProps = {
  leagues: OpenLeagueViewModel[];
};

export default function OpenLeaguesList({ leagues }: OpenLeaguesListProps) {
  if (leagues.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 text-sm text-[var(--text-muted)]">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Open leagues
        </p>
        <p className="mt-3 text-[var(--text-muted)]">No public leagues available right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
        Open leagues
      </p>
      <div className="mt-4 space-y-3">
        {leagues.map((league) => (
          <div
            key={league.id}
            className="flex items-center justify-between rounded-2xl border border-white/5 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{league.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{league.teamsCount} teams</p>
            </div>
            <Link
              href={`/leagues/${league.id}`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
