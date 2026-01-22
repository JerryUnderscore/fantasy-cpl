import Link from "next/link";
import TeamSwitcher, { TeamSwitcherOption } from "./team-switcher";

type TeamContextHeaderProps = {
  teamName: string;
  leagueName: string;
  seasonLabel: string;
  leagueId: string;
  teamId: string;
  switcherOptions?: TeamSwitcherOption[];
};

export default function TeamContextHeader({
  teamName,
  leagueName,
  seasonLabel,
  leagueId,
  teamId,
  switcherOptions,
}: TeamContextHeaderProps) {
  const showSwitcher = switcherOptions && switcherOptions.length > 1;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface2)] px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--text-muted)]">My Teams</p>
        <h1 className="text-3xl font-semibold text-white">{teamName}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {leagueName} · {seasonLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showSwitcher && switcherOptions ? (
          <TeamSwitcher
            selectedId={teamId}
            options={switcherOptions}
          />
        ) : null}
        <Link
          href={`/leagues/${leagueId}/team`}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          View team
        </Link>
      </div>
    </div>
  );
}
