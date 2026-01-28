import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import MatchScheduleList, {
  type ScheduleMatch,
} from "@/components/match-schedule";
import { formatEasternDateTime } from "@/lib/time";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import { normalizeLeagueWaiverTimes } from "@/lib/waivers";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";

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

  const draft = await prisma.draft.findUnique({
    where: { leagueId_seasonId: { leagueId: league.id, seasonId: league.seasonId } },
    select: { id: true, status: true, rounds: true },
  });

  const draftedCount = draft
    ? await prisma.draftPick.count({ where: { draftId: draft.id } })
    : 0;
  const totalDraftPicks =
    draft && draft.rounds ? draft.rounds * teamsWithCounts.length : 0;
  const draftComplete =
    !league.season.isActive ||
    league.draftMode === "NONE" ||
    (draft?.status === "COMPLETE") ||
    (totalDraftPicks > 0 && draftedCount >= totalDraftPicks);
  const showDraftButton = !draftComplete;

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
        profileId: team.profileId,
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
          homeClub: { select: { name: true, shortName: true, slug: true } },
          awayClub: { select: { name: true, shortName: true, slug: true } },
        },
      })
    : [];

  const scheduleMatchesPayload: ScheduleMatch[] = scheduleMatches.map(
    (match) => ({
      ...match,
      kickoffAt: match.kickoffAt.toISOString(),
    }),
  );

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
          jerseyNumber: true,
          position: true,
          club: { select: { shortName: true, name: true } },
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_25px_45px_rgba(1,2,12,0.65)]">
        <div className="flex flex-col gap-2">
          <Link
            href="/leagues"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            Back to leagues
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-[var(--text)]">
              {league.name}
            </h1>
            {showDraftButton ? (
              <Link
                href={`/leagues/${league.id}/draft`}
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-[var(--accent-muted)]"
              style={{ color: "#101014" }}
              >
                Draft
              </Link>
            ) : null}
            {membership.role === "OWNER" ? (
              <Link
                href={`/leagues/${league.id}/settings`}
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] p-2 text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                aria-label="League settings"
              >
                <span role="img" aria-hidden="true" className="text-lg">
                  ⚙️
                </span>
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            {league.season.name} · {league.season.year}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-[var(--text-muted)]">
            <Link
              href={`/leagues/${league.id}/players`}
              className="transition hover:text-[var(--text)] hover:underline underline-offset-4"
            >
              Players
            </Link>
            <Link
              href={`/leagues/${league.id}/trades`}
              className="transition hover:text-[var(--text)] hover:underline underline-offset-4"
            >
              Trades
            </Link>
            <Link
              href={`/leagues/${league.id}/settings`}
              className="transition hover:text-[var(--text)] hover:underline underline-offset-4"
            >
              League settings
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Standings
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {latestFinalizedMatchWeek?.number
                ? `After MatchWeek ${latestFinalizedMatchWeek.number}`
                : currentMatchWeek?.number
                  ? `MatchWeek ${currentMatchWeek.number} in progress`
                  : "No MatchWeek data yet"}
            </p>
          </div>
          {standings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">No teams yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Team</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Points</th>
                    <th className="py-2 pr-3">Played</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text)]">
                  {standings.map((row) => (
                    <tr
                      key={row.teamId}
                      className="border-t border-[var(--border)]"
                    >
                      <td className="py-2 pr-3 text-[var(--text-muted)]">
                        {row.rank}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-[var(--text)]">
                        <Link
                          href={
                            row.profileId === profile.id
                              ? `/leagues/${league.id}/team`
                              : `/leagues/${league.id}/teams/${row.teamId}`
                          }
                          className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                        >
                          {row.teamName}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-[var(--text-muted)]">
                        {row.ownerName}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-[var(--text)]">
                        {row.totalPoints}
                      </td>
                      <td className="py-2 pr-3 text-[var(--text-muted)]">
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                MatchWeek schedule
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {currentMatchWeek?.number
                  ? `MatchWeek ${currentMatchWeek.number}`
                  : "No MatchWeek scheduled"}
              </p>
            </div>
            {scheduleMatchesPayload.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No matches scheduled yet.
              </p>
            ) : (
              <div className="mt-4">
                <MatchScheduleList matches={scheduleMatchesPayload} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                On waivers
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Claim window</p>
            </div>
            {waivers.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No players on waivers.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {waivers.map((waiver) => (
                  <li
                    key={waiver.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {formatPlayerName(
                        waiver.player.name,
                        waiver.player.jerseyNumber,
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {waiver.player.position} ·{" "}
                      {waiver.player.club
                        ? getClubDisplayName(
                            waiver.player.club.slug,
                            waiver.player.club.name,
                          )
                        : "No club"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
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
      </div>
    </div>
  );
}
