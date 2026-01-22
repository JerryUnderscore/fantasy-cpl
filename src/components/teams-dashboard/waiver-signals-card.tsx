import Link from "next/link";
import type { WaiverSignal } from "./types";

type WaiverSignalsCardProps = {
  waivers: WaiverSignal;
  leagueId: string;
};

export default function WaiverSignalsCard({ waivers, leagueId }: WaiverSignalsCardProps) {
  const badgeLabel = waivers.hasOpportunities ? "Opportunity" : "Clear";
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Waiver signals
        </p>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
            waivers.hasOpportunities ? "bg-[var(--warning)] text-[var(--background)]" : "bg-white/5 text-[var(--text-muted)]"
          }`}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="mt-4 text-sm text-[var(--text)]">{waivers.summaryText}</p>
      <Link
        href={`/leagues/${leagueId}`}
        className="mt-4 inline-flex items-center text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-muted)]"
      >
        Review league waivers →
      </Link>
    </div>
  );
}
