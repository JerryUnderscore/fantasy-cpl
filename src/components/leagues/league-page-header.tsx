import type { ReactNode } from "react";

type Props = {
  title: string;
  leagueName: string;
  leagueBadgeUrl?: string;
  showBadgeTooltip?: boolean;
  actions?: ReactNode;
};

const getFallbackLabel = (leagueName: string) => {
  const trimmed = leagueName.trim();
  if (!trimmed) return "L";
  return trimmed[0].toUpperCase();
};

export default function LeaguePageHeader({
  title,
  leagueName,
  leagueBadgeUrl,
  showBadgeTooltip = false,
  actions,
}: Props) {
  const showTooltip = showBadgeTooltip && !leagueBadgeUrl;
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
          title={
            showTooltip
              ? "Commissioners can add a league badge (coming soon)"
              : undefined
          }
        >
          {leagueBadgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={leagueBadgeUrl}
              alt={`${leagueName} badge`}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-semibold text-[var(--text)]">
              {getFallbackLabel(leagueName)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-[var(--text)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{leagueName}</p>
        </div>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
