import type { StandingsSnapshot } from "./types";

type StandingsSnapshotCardProps = {
  standings: StandingsSnapshot;
};

const formatMovement = (value: number | undefined) => {
  if (value === undefined) return "—";
  if (value === 0) return "No change";
  return value > 0 ? `+${value}` : `${value}`;
};

export default function StandingsSnapshotCard({ standings }: StandingsSnapshotCardProps) {
  const movementLabel = formatMovement(standings.deltaRank);
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Standings snapshot
        </p>
        <span className="text-xs text-[var(--accent)]">Live</span>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Rank</p>
          <p className="text-4xl font-semibold text-white">#{standings.rank}</p>
          <p className="text-sm text-[var(--text-muted)]">of {standings.totalTeams}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Points</p>
          <p className="text-4xl font-semibold text-white">{standings.points}</p>
          <p className="text-sm text-[var(--accent)]">
            {standings.deltaPoints !== undefined
              ? formatMovement(standings.deltaPoints) + " pts"
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Movement</p>
          <p className="text-4xl font-semibold text-white">{movementLabel}</p>
          <p className="text-sm text-[var(--text-muted)]">rank vs last matchweek</p>
        </div>
      </div>
    </div>
  );
}
