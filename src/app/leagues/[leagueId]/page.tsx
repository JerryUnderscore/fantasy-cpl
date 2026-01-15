import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import TeamPanel from "./team-panel";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

async function getLeague(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: { season: true },
  });
}

async function getMembership(leagueId: string, profileId: string) {
  return prisma.leagueMember.findUnique({
    where: { leagueId_profileId: { leagueId, profileId } },
  });
}

async function getTeams(leagueId: string) {
  return prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      profile: { select: { displayName: true } },
      rosterSlots: { select: { playerId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export default async function LeagueDetailPage({
  params,
}: {
  params: LeagueParams | Promise<LeagueParams>;
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
            <h1 className="text-3xl font-semibold text-black">League teams</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view the teams in this league.
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

  const league = await getLeague(leagueId);
  if (!league) notFound();

  const membership = await getMembership(league.id, profile.id);
  if (!membership) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Not a league member
          </h1>
          <p className="text-sm text-zinc-500">
            You need to join this league before viewing its teams.
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

  const teams = await getTeams(league.id);
  const teamsWithCounts = teams.map((team) => ({
    ...team,
    filledCount: team.rosterSlots.filter((slot) => slot.playerId).length,
  }));
  const currentTeam =
    teamsWithCounts.find((t) => t.profileId === profile.id) ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
          <h1 className="text-3xl font-semibold text-black">{league.name}</h1>
          <p className="text-sm text-zinc-500">
            {league.season.name} · {league.season.year}
          </p>
          <Link
            href={`/leagues/${league.id}/draft`}
            className="mt-3 w-fit rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Go to draft
          </Link>
        </div>

        <TeamPanel
          leagueId={league.id}
          initialTeamName={currentTeam?.name ?? null}
        />

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            League teams
          </h2>

          {teamsWithCounts.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No teams yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {teamsWithCounts.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-zinc-900">
                      {t.name}
                    </p>
                    <Link
                      href={
                        t.profileId === profile.id
                          ? `/leagues/${league.id}/team`
                          : `/leagues/${league.id}/teams/${t.id}`
                      }
                      className="text-xs font-semibold uppercase tracking-wide text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
                    >
                      View roster
                    </Link>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Owner: {t.profile.displayName ?? "Unknown"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Filled: {t.filledCount}/15
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
