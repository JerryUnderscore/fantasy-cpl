import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function LeagueRulesPage({
  params,
}: {
  params: LeagueParams;
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
            <h1 className="text-3xl font-semibold text-black">League rules</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view league rules.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
        </div>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
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

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      season: { select: { id: true, name: true, year: true } },
    },
  });

  if (!league) notFound();

  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true },
  });

  if (!membership) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Not a league member
          </h1>
          <p className="text-sm text-zinc-500">
            You need to join this league before viewing its rules.
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

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
          <h1 className="text-3xl font-semibold text-black">League rules</h1>
          <p className="text-sm text-zinc-500">
            {league.name} · {league.season.name} {league.season.year}
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-black">Rules</h2>
            <p className="text-sm text-zinc-600">
              Shared rules for all leagues during the beta season.
            </p>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                League structure
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Each league is private and created by a commissioner.</li>
                <li>All leagues use the same rules and scoring system.</li>
                <li>Each league operates independently (no cross-league play).</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Teams & rosters
              </h3>
              <p className="text-sm text-zinc-600">
                Each fantasy team has a fixed roster size and position structure.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Goalkeepers (GK)</li>
                <li>Defenders (DEF)</li>
                <li>Midfielders (MID)</li>
                <li>Forwards (FWD)</li>
              </ul>
              <p className="text-sm text-zinc-600">
                Roster limits are fixed for all leagues and cannot be customized
                during the beta.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Draft
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Live and casual leagues use a snake draft.</li>
                <li>Draft order is randomized.</li>
                <li>Live drafts are timed; casual drafts are untimed.</li>
                <li>Some leagues skip the draft and open free agency immediately.</li>
              </ul>
              <p className="text-sm text-zinc-600">
                There is no salary cap or player pricing during the beta season.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Transfers & trades
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Each team gets two transfer additions per matchweek.</li>
                <li>Transfers include free agents and won waiver claims.</li>
                <li>Unsuccessful waiver claims do not count.</li>
                <li>Trades do not count toward the transfer limit.</li>
                <li>
                  Players added after lock stay on the bench until the next open
                  matchweek.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Lineups
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Lineups are set weekly.</li>
                <li>Lineups lock at the first kickoff of the matchweek.</li>
                <li>Once locked, lineups cannot be changed.</li>
              </ul>
              <p className="text-sm font-medium text-zinc-700">
                Starting lineup rules
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>
                  A starting lineup must include the required number of outfield
                  players.
                </li>
                <li>Goalkeeper is optional.</li>
                <li>If you start a goalkeeper, they score points normally.</li>
                <li>
                  If you do not start a goalkeeper, you receive no goalkeeper
                  points.
                </li>
                <li>
                  Players on the bench do not score points.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Scoring
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Appearance: +1</li>
                <li>
                  Goal:
                  <ul className="list-[circle] space-y-1 pl-5">
                    <li>GK / DEF: +5</li>
                    <li>MID: +4</li>
                    <li>FWD: +3</li>
                  </ul>
                </li>
                <li>Assist: +3</li>
                <li>Clean sheet (GK / DEF, minimum 60 minutes): +4</li>
                <li>Yellow card: -1</li>
                <li>Red card: -3</li>
                <li>Own goal: -2</li>
              </ul>
              <p className="text-sm text-zinc-600">
                There are no bonus points, advanced metrics, or subjective
                awards.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Matchups & standings
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>
                  Leagues may use head-to-head matchups or total points
                  standings (league default).
                </li>
                <li>Weekly points determine matchup results.</li>
                <li>Standings update after each matchweek is finalized.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Stats & updates
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Match statistics are entered manually during the beta.</li>
                <li>Updates may occur after the final match of the matchweek.</li>
                <li>Scores are provisional until finalized.</li>
              </ul>
              <p className="text-sm text-zinc-600">
                Corrections, delays, and edge cases may occur during the beta.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Sportsmanship & fair use
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>
                  League names, team names, and user content must remain
                  reasonable.
                </li>
                <li>
                  Commissioners may remove teams for disruptive or abusive
                  behavior.
                </li>
                <li>
                  Exploits, automation, or intentional abuse may result in
                  removal.
                </li>
              </ul>
              <p className="text-sm font-medium text-zinc-700">
                Basically: do not be weird.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
