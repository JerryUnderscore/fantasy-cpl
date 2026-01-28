import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import SettingsClient from "./settings-client";
import LeaguePageHeader from "@/components/leagues/league-page-header";

export const runtime = "nodejs";

type SettingsParams = { leagueId: string };

export default async function LeagueSettingsPage({
  params,
}: {
  params: SettingsParams;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-[var(--accent-muted)]">
              League settings
            </h1>
            <p className="text-sm text-zinc-500">
              Sign in to view league settings.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Profile not synced
          </h1>
          <p className="text-sm text-zinc-500">
            Please sync your profile from the home page and try again.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
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
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Not a league member
          </h1>
          <p className="text-sm text-zinc-500">
            You need to join this league before viewing its settings.
          </p>
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href={`/leagues/${leagueSummary.id}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
          <LeaguePageHeader
            title="League settings"
            leagueName={leagueSummary.name}
            showBadgeTooltip={isOwner}
          />
          <p className="text-sm text-zinc-500">
            Season: {leagueSummary.season.name} {leagueSummary.season.year}
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                League configuration
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Settings picked by the commissioner for this league.
              </p>
            </div>
            <Link
              href="/rules"
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:border-zinc-300 hover:text-black"
            >
              View full Fantasy CPL rules
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
        </section>

        {isOwner ? (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                Commissioner controls
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Manage the configuration below. Changes apply league-wide.
              </p>
            </div>
            <SettingsClient
              leagueId={leagueSummary.id}
              leagueName={leagueSummary.name}
            />
          </div>
        ) : (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Only the commissioner can edit league settings.
          </p>
        )}
      </div>
    </div>
  );
}
