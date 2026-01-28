import Link from "next/link";
import type { TeamsCompactRowModel, LineupStatusState } from "./types";
import { clickableRow } from "@/components/layout/ui-interactions";

const statusDotColor: Record<LineupStatusState, string> = {
  SET: "bg-[var(--success)]",
  MISSING_SLOTS: "bg-[var(--warning)]",
  NON_STARTERS: "bg-[var(--accent)]",
  NOT_OPEN: "bg-white/60",
};

type TeamsCompactListProps = {
  rows: TeamsCompactRowModel[];
};

export default function TeamsCompactList({ rows }: TeamsCompactListProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 text-center text-sm text-[var(--text-muted)]">
        No teams to display.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">My Teams</h1>
        <p className="text-sm text-[var(--text-muted)]">Tap a team to view its dashboard.</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/my-teams?teamId=${encodeURIComponent(row.id)}`}
            data-testid={`teams-list-row-${row.id}`}
            className={`flex items-center justify-between rounded-3xl border border-white/5 bg-[var(--surface2)] px-5 py-4 text-sm shadow-sm ${clickableRow}`}
          >
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${statusDotColor[row.lineupState]}`} />
              <div>
                <p className="text-sm font-semibold text-white">{row.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{row.leagueName}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Rank</p>
                <p className="text-lg font-semibold text-white">#{row.rank}</p>
                <p className="text-xs text-[var(--text-muted)]">of {row.totalTeams}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
                  Next deadline
                </p>
                <p className="text-sm font-semibold text-[var(--accent)]">
                  {row.upcomingDeadline?.label ?? "TBD"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {row.upcomingDeadline?.relativeText ?? "—"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
