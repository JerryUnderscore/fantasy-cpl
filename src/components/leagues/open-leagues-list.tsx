import Link from "next/link";
import type { OpenLeagueViewModel } from "./types";
import SectionCard from "@/components/layout/section-card";
import EmptyState from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/ui-interactions";

type OpenLeaguesListProps = {
  leagues: OpenLeagueViewModel[];
};

export default function OpenLeaguesList({ leagues }: OpenLeaguesListProps) {
  if (leagues.length === 0) {
    return (
      <SectionCard title="Open leagues">
        <EmptyState
          title="No public leagues"
          description="There are no open leagues available right now."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Open leagues">
      <div className="space-y-3">
        {leagues.map((league) => (
          <div
            key={league.id}
            className={`flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 ${clickableRow}`}
          >
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{league.name}</p>
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
    </SectionCard>
  );
}
