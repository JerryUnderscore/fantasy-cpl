import Link from "next/link";
import type { LineupStatusState, UpcomingMatchweekInfo } from "./types";

type LineupStatusCardProps = {
  leagueId: string;
  lineupStatus: { state: LineupStatusState; missingSlots?: number; nonStarters?: number };
  upcomingMatchweek: UpcomingMatchweekInfo;
};

const statusTitles: Record<LineupStatusState, string> = {
  SET: "Lineup is set",
  MISSING_SLOTS: "Slots waiting",
  NON_STARTERS: "Needs tweaks",
  NOT_OPEN: "Lineups not open",
};

const statusDescriptions: Record<LineupStatusState, string> = {
  SET: "You’re good to go. No gaps detected for the upcoming matchweek.",
  MISSING_SLOTS: "Some starters are still missing. Lock them in before matchweek kicks off.",
  NON_STARTERS: "Bench players are still ahead. Confirm your final starters.",
  NOT_OPEN: "Lineups not open. Be ready to swap in your roster.",
};

const accentBadges: Record<LineupStatusState, string> = {
  SET: "text-[var(--success)]",
  MISSING_SLOTS: "text-[var(--warning)]",
  NON_STARTERS: "text-[var(--accent)]",
  NOT_OPEN: "text-[var(--text-muted)]",
};

const formatLockTime = (lockAt: string | null) => {
  if (!lockAt) return "Locking soon";
  const date = new Date(lockAt);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function LineupStatusCard({
  leagueId,
  lineupStatus,
  upcomingMatchweek,
}: LineupStatusCardProps) {
  const { state, missingSlots, nonStarters } = lineupStatus;
  const needsAction = state !== "SET";
  const labelParts: string[] = [];

  if (state === "MISSING_SLOTS" && missingSlots) {
    labelParts.push(`${missingSlots} starter${missingSlots === 1 ? "" : "s"} missing`);
  } else if (state === "NON_STARTERS" && nonStarters) {
    labelParts.push(`${nonStarters} bench player${nonStarters === 1 ? "" : "s"} ahead`);
  }

  const statusTag = labelParts.length > 0 ? labelParts.join(" • ") : statusTitles[state];

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#11141d] via-[#0d1015] to-[#060608] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Lineup status
        </p>
        <span className={`text-xs font-semibold ${accentBadges[state]}`}>
          {state}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--text-muted)]">
          {upcomingMatchweek.label}
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          {statusTitles[state]}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{statusDescriptions[state]}</p>
        <p className="mt-3 text-sm text-[var(--accent)]">{statusTag}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/leagues/${leagueId}/team`}
          className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
            needsAction
              ? "bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)]"
              : "border border-white/10 text-[var(--text-muted)]"
          }`}
        >
          {needsAction ? "Set lineup" : "View lineup"}
        </Link>
        <p className="text-xs text-[var(--text-muted)]">Locks {formatLockTime(upcomingMatchweek.lockAt)}</p>
      </div>
    </div>
  );
}
