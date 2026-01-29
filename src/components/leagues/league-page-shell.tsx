import type { ReactNode } from "react";
import Link from "next/link";
import LeaguePageHeader from "@/components/leagues/league-page-header";
import PageHeader from "@/components/layout/page-header";
import {
  leagueHeaderSpacing,
  leaguePageMaxWidth,
  leaguePagePaddingX,
  leaguePagePaddingY,
  leagueSurface,
} from "@/components/leagues/league-page-tokens";

type LeaguePageShellProps = {
  backHref: string;
  backLabel?: string;
  leagueTitle: string;
  seasonLabel: string;
  pageTitle: string;
  pageSubtitle?: string | null;
  leagueBadgeUrl?: string;
  showBadgeTooltip?: boolean;
  actions?: ReactNode;
  headerContent?: ReactNode;
  pageBadge?: string | null;
  children: ReactNode;
};

export default function LeaguePageShell({
  backHref,
  backLabel = "Back to league",
  leagueTitle,
  seasonLabel,
  pageTitle,
  pageSubtitle,
  leagueBadgeUrl,
  showBadgeTooltip = false,
  actions,
  headerContent,
  pageBadge,
  children,
}: LeaguePageShellProps) {
  return (
    <div className={`mx-auto flex w-full ${leaguePageMaxWidth} flex-col`}>
      <div
        className={`flex w-full flex-col gap-8 ${leagueSurface} ${leaguePagePaddingX} ${leaguePagePaddingY}`}
      >
        <div className={leagueHeaderSpacing}>
          <Link
            href={backHref}
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            {backLabel}
          </Link>
          <LeaguePageHeader
            title={leagueTitle}
            leagueName={seasonLabel}
            leagueBadgeUrl={leagueBadgeUrl}
            showBadgeTooltip={showBadgeTooltip}
            actions={actions}
          />
          <PageHeader title={pageTitle} subtitle={pageSubtitle} badge={pageBadge} />
          {headerContent ? (
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-[var(--text-muted)]">
              {headerContent}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
