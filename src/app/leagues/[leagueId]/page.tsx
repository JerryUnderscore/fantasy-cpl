import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import { formatEasternDateTime } from "@/lib/time";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { normalizeLeagueWaiverTimes } from "@/lib/waivers";
import TeamRenameLink from "./team-rename-link";

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
    select: { role: true },
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
  params: Promise<LeagueParams>;
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

  const [currentMatchWeek, latestFinalizedMatchWeek] = await Promise.all([
    getCurrentMatchWeekForSeason(league.seasonId),
    prisma.matchWeek.findFirst({
      where: { seasonId: league.seasonId, status: "FINALIZED" },
      orderBy: { number: "desc" },
      select: { number: true },
    }),
  ]);

  const teamIds = teamsWithCounts.map((team) => team.id);
  const scoreAggregates = teamIds.length
    ? await prisma.teamMatchWeekScore.groupBy({
        by: ["fantasyTeamId"],
        where: { fantasyTeamId: { in: teamIds }, status: "FINAL" },
        _sum: { points: true },
        _count: { _all: true },
      })
    : [];
  const scoreMap = new Map(
    scoreAggregates.map((row) => [row.fantasyTeamId, row]),
  );

  const standings = teamsWithCounts
    .map((team) => {
      const summary = scoreMap.get(team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        ownerName: team.profile.displayName ?? "Unknown",
        totalPoints: summary?._sum.points ?? 0,
        playedFinalized: summary?._count._all ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (b.playedFinalized !== a.playedFinalized) {
        return b.playedFinalized - a.playedFinalized;
      }
      return a.teamName.localeCompare(b.teamName);
    })
    .map((row, index) => ({ rank: index + 1, ...row }));

  const scheduleMatches = currentMatchWeek
    ? await prisma.match.findMany({
        where: { matchWeekId: currentMatchWeek.id },
        orderBy: { kickoffAt: "asc" },
        select: {
          id: true,
          kickoffAt: true,
          status: true,
          homeClub: { select: { name: true, shortName: true } },
          awayClub: { select: { name: true, shortName: true } },
        },
    })
    : [];

  const normalizedReset = await normalizeLeagueWaiverTimes(
    prisma,
    league.id,
    new Date(),
  );
  const waivers = await prisma.leaguePlayerWaiver.findMany({
    where: { leagueId, player: { active: true } },
    orderBy: { waiverAvailableAt: "asc" },
    select: {
      id: true,
      waiverAvailableAt: true,
      player: {
        select: {
          id: true,
          name: true,
          position: true,
          club: { select: { shortName: true, name: true } },
        },
      },
    },
  });

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-black">
              {league.name}
            </h1>
            {membership.role === "OWNER" ? (
              <Link
                href={`/leagues/${league.id}/settings`}
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 p-2 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                aria-label="League settings"
              >
                <span role="img" aria-hidden="true" className="text-lg">
                  ⚙️
                </span>
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-zinc-500">
            {league.season.name} · {league.season.year}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-zinc-500">
            <Link
              href={`/leagues/${league.id}/players`}
              className="underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Players
            </Link>
            <Link
              href={`/leagues/${league.id}/draft-prep`}
              className="underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Draft prep
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Standings
            </h2>
            <p className="text-xs text-zinc-500">
              {latestFinalizedMatchWeek?.number
                ? `After MatchWeek ${latestFinalizedMatchWeek.number}`
                : currentMatchWeek?.number
                  ? `MatchWeek ${currentMatchWeek.number} in progress`
                  : "No MatchWeek data yet"}
            </p>
          </div>
          {standings.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No teams yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Team</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Points</th>
                    <th className="py-2 pr-3">Played</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800">
                  {standings.map((row) => (
                    <tr key={row.teamId} className="border-t border-zinc-200">
                      <td className="py-2 pr-3 text-zinc-500">{row.rank}</td>
                      <td className="py-2 pr-3 font-semibold text-zinc-900">
                        {row.teamName}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {row.ownerName}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-zinc-900">
                        {row.totalPoints}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {row.playedFinalized}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                MatchWeek schedule
              </h2>
              <p className="text-xs text-zinc-500">
                {currentMatchWeek?.number
                  ? `MatchWeek ${currentMatchWeek.number}`
                  : "No MatchWeek scheduled"}
              </p>
            </div>
            {scheduleMatches.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No matches scheduled yet.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {scheduleMatches.map((match) => (
                  <li
                    key={match.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-zinc-900">
                      {match.homeClub.shortName ?? match.homeClub.name} vs{" "}
                      {match.awayClub.shortName ?? match.awayClub.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatEasternDateTime(new Date(match.kickoffAt))} ET ·{" "}
                      {match.status}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                On waivers
              </h2>
              <p className="text-xs text-zinc-500">Claim window</p>
            </div>
            {waivers.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No players on waivers.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {waivers.map((waiver) => (
                  <li
                    key={waiver.id}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {waiver.player.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {waiver.player.position} ·{" "}
                      {waiver.player.club?.shortName ??
                        waiver.player.club?.name ??
                        "No club"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Clears:{" "}
                      {formatEasternDateTime(
                        new Date(
                          normalizedReset ?? waiver.waiverAvailableAt,
                        ),
                      )}{" "}
                      ET
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-base font-semibold text-zinc-900">
                      {t.name}
                    </p>
                    <div className="flex flex-col items-end gap-1">
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
                      {t.profileId === profile.id ? (
                        <TeamRenameLink
                          leagueId={league.id}
                          initialTeamName={t.name}
                        />
                      ) : null}
                    </div>
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
