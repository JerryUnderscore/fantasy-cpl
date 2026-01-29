import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import SettingsClient from "./settings-client";
import SectionCard from "@/components/layout/section-card";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type SettingsParams = { leagueId: string };

export default async function LeagueSettingsPage({
  params,
}: {
  params: Promise<SettingsParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const leagueSummary = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      season: { select: { id: true, name: true, year: true } },
      teamCount: true,
      maxTeams: true,
      standingsMode: true,
      draftMode: true,
      draftPickSeconds: true,
      draftScheduledAt: true,
      joinMode: true,
      rosterSize: true,
      waiverPeriodHours: true,
      createdBy: { select: { displayName: true } },
    },
  });

  if (!leagueSummary) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={leagueSummary.name}
        seasonLabel={`Season ${leagueSummary.season.name} ${leagueSummary.season.year}`}
        pageTitle="League settings"
        pageSubtitle="Sign in to view league settings."
      >
          <AuthButtons isAuthenticated={false} />
      </LeaguePageShell>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={leagueSummary.name}
        seasonLabel={`Season ${leagueSummary.season.name} ${leagueSummary.season.year}`}
        pageTitle="League settings"
        pageSubtitle="Please sync your profile from the home page and try again."
      >
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            Go to home
          </Link>
      </LeaguePageShell>
    );
  }

  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { role: true },
  });

  if (!membership) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={leagueSummary.name}
        seasonLabel={`Season ${leagueSummary.season.name} ${leagueSummary.season.year}`}
        pageTitle="League settings"
        pageSubtitle="You need to join this league before viewing its settings."
      >
        <Link
          href="/leagues"
          className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
        >
          Browse leagues
        </Link>
      </LeaguePageShell>
    );
  }

  const isOwner = membership.role === "OWNER";

  const standingsLabel =
    leagueSummary.standingsMode === "HEAD_TO_HEAD"
      ? "Head-to-head"
      : "Total points";
  const draftLabel =
    leagueSummary.draftMode === "LIVE"
      ? "Live (timed)"
      : leagueSummary.draftMode === "CASUAL"
        ? "Casual (untimed)"
        : "No draft";
  const joinLabel = leagueSummary.joinMode === "OPEN" ? "Open" : "Invite only";
  const goalkeeperRequirement = "Optional";
  const goalkeeperHelper = "Teams may start a GK but are not required to.";
  const commissionerName =
    leagueSummary.createdBy.displayName?.trim() || "Commissioner";

  const draftSchedule = leagueSummary.draftScheduledAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(leagueSummary.draftScheduledAt)
    : "Not scheduled";

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueSummary.id}`}
      leagueTitle={leagueSummary.name}
      seasonLabel={`Season ${leagueSummary.season.name} ${leagueSummary.season.year}`}
      pageTitle="League settings"
      pageSubtitle="League summary and commissioner tools for this league."
      showBadgeTooltip={isOwner}
      pageBadge={isOwner ? "Commissioner" : null}
    >
      <SectionCard
        title="League summary"
        description="Settings picked by the commissioner for this league."
        actions={
          <Link
            href="/rules"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            View full Fantasy CPL rules
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              League name
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {leagueSummary.name}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Commissioner
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {commissionerName}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Teams
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {leagueSummary.teamCount} of {leagueSummary.maxTeams}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Scoring format
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {standingsLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Draft type
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {draftLabel}
            </p>
            {leagueSummary.draftMode === "LIVE" ? (
              <p className="mt-1 text-xs text-zinc-500">
                {leagueSummary.draftPickSeconds
                  ? `Pick clock: ${Math.round(
                      leagueSummary.draftPickSeconds / 60,
                    )} min`
                  : "Pick clock: —"}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Draft schedule
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {draftSchedule}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Join mode
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {joinLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Roster size
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {leagueSummary.rosterSize} players
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Goalkeeper requirement
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {goalkeeperRequirement}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {goalkeeperHelper}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Waiver period
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {leagueSummary.waiverPeriodHours} hours
            </p>
          </div>
        </div>
      </SectionCard>

      {isOwner ? (
        <SectionCard
          title="Commissioner tools"
          description="Manage the configuration below. Changes apply league-wide."
        >
          <SettingsClient
            leagueId={leagueSummary.id}
            leagueName={leagueSummary.name}
          />
        </SectionCard>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Only the commissioner can edit league settings.
        </p>
      )}
    </LeaguePageShell>
  );
}
