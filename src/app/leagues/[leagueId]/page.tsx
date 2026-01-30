import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import MatchScheduleList, {
  type ScheduleMatch,
} from "@/components/match-schedule";
import { getCurrentMatchWeekForSeason } from "@/lib/matchweek";
import LocalDateTime from "@/components/local-date-time";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";
import EmptyState from "@/components/layout/empty-state";
import SectionCard from "@/components/layout/section-card";
import LeaguePageShell from "@/components/leagues/league-page-shell";
import JoinOpenLeagueButton from "@/components/leagues/join-open-league-button";
import LeagueOverviewMobile from "./league-overview-mobile";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

async function getLeague(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      seasonId: true,
      season: true,
      joinMode: true,
      teamCount: true,
      maxTeams: true,
      draftMode: true,
    },
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

  const league = await getLeague(leagueId);
  if (!league) notFound();
  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Overview"
        pageSubtitle="Sign in to view the teams in this league."
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
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Overview"
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

  const membership = await getMembership(league.id, profile.id);
  const isOpenJoin = league.joinMode === "OPEN";
  const isMember = Boolean(membership);
  const isReadOnly = !isMember && isOpenJoin;
  const isFull = league.teamCount >= league.maxTeams;
  const memberRole = membership?.role ?? null;

  if (!membership && !isOpenJoin) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Overview"
        pageSubtitle="You need to join this league before viewing its teams."
      >
        <div className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
          <p>Invite code required to join this league.</p>
          <Link
            href="/leagues"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
          >
            Browse leagues
          </Link>
        </div>
      </LeaguePageShell>
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

  const currentTeam = teamsWithCounts.find(
    (team) => team.profileId === profile.id,
  );

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

  const pendingClaims = currentTeam
    ? await prisma.leagueWaiverClaim.findMany({
        where: {
          leagueId,
          fantasyTeamId: currentTeam.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          player: {
            select: {
              id: true,
              name: true,
              jerseyNumber: true,
              position: true,
              club: { select: { shortName: true, slug: true, name: true } },
            },
          },
          dropPlayer: {
            select: {
              id: true,
              name: true,
              jerseyNumber: true,
              position: true,
              club: { select: { shortName: true, slug: true, name: true } },
            },
          },
        },
      })
    : [];

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
          club: { select: { shortName: true, name: true, slug: true } },
        },
      },
    },
  });

  const matchweekLabel = currentMatchWeek?.number
    ? `MatchWeek ${currentMatchWeek.number}`
    : latestFinalizedMatchWeek?.number
      ? `MatchWeek ${latestFinalizedMatchWeek.number}`
      : "MatchWeek";

  const matchweekContext = draft?.status === "LIVE"
    ? "Draft live · Picks on the clock"
    : currentMatchWeek?.number
      ? `MatchWeek ${currentMatchWeek.number} in progress`
      : latestFinalizedMatchWeek?.number
        ? `Last finalized: MatchWeek ${latestFinalizedMatchWeek.number}`
        : "MatchWeek updates coming soon";

  return (
    <LeaguePageShell
      backHref="/leagues"
      backLabel="Back to leagues"
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle="Overview"
      pageSubtitle="Standings, schedule, and waiver activity for this league."
      showBadgeTooltip={memberRole === "OWNER"}
      hideHeaderOnMobile
      actions={
        isMember ? (
          <>
            {showDraftButton ? (
              <Link
                href={`/leagues/${league.id}/draft`}
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-[var(--accent-muted)]"
                style={{ color: "#101014" }}
              >
                Draft
              </Link>
            ) : null}
            {memberRole === "OWNER" ? (
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
          </>
        ) : null
      }
      headerContent={
        isMember ? (
          <>
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
          </>
        ) : null
      }
    >
      <div className="sm:hidden">
        <LeagueOverviewMobile
          leagueId={league.id}
          leagueName={league.name}
          backHref="/leagues"
          matchweekLabel={matchweekLabel}
          matchweekContext={matchweekContext}
          showSettings={memberRole === "OWNER"}
          standings={standings.map((row) => ({
            rank: row.rank,
            teamName: row.teamName,
            ownerName: row.ownerName,
            totalPoints: row.totalPoints,
            playedFinalized: row.playedFinalized,
            href:
              row.profileId === profile.id
                ? `/leagues/${league.id}/team`
                : `/leagues/${league.id}/teams/${row.teamId}`,
          }))}
          scheduleMatches={scheduleMatchesPayload}
          waivers={waivers.map((waiver) => ({
            id: waiver.id,
            waiverAvailableAt: waiver.waiverAvailableAt.toISOString(),
            player: waiver.player,
          }))}
          pendingClaims={pendingClaims.map((claim) => ({
            id: claim.id,
            createdAt: claim.createdAt.toISOString(),
            player: claim.player,
            dropPlayer: claim.dropPlayer,
          }))}
        />
      </div>

      <div className="hidden sm:block">
      {isReadOnly ? (
        <SectionCard
          title="Open league"
          description="Read-only view. Join to manage a team, trades, and waivers."
          actions={
            <JoinOpenLeagueButton
              leagueId={league.id}
              label={isFull ? "League full" : "Join league"}
              disabled={isFull}
              className="px-4 py-1.5 text-xs"
            />
          }
        >
          <p className="text-sm text-[var(--text-muted)]">
            You can browse teams and rosters before joining.
          </p>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Standings"
        actions={
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {latestFinalizedMatchWeek?.number
              ? `After MatchWeek ${latestFinalizedMatchWeek.number}`
              : currentMatchWeek?.number
                ? `MatchWeek ${currentMatchWeek.number} in progress`
                : "No MatchWeek data yet"}
          </span>
        }
      >
        {standings.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Once teams join, standings will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
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
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title="MatchWeek schedule"
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {currentMatchWeek?.number
                ? `MatchWeek ${currentMatchWeek.number}`
                : "No MatchWeek scheduled"}
            </span>
          }
        >
          {scheduleMatchesPayload.length === 0 ? (
            <EmptyState
              title="No matches scheduled"
              description="CPL matchups will appear here once the schedule is published."
            />
          ) : (
            <MatchScheduleList matches={scheduleMatchesPayload} />
          )}
        </SectionCard>

        <SectionCard
          title="On waivers"
          actions={
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Claim window
            </span>
          }
        >
          {waivers.length === 0 ? (
            <EmptyState
              title="No players on waivers"
              description="Waiver claims will appear here when players enter the window."
            />
          ) : (
            <ul className="flex flex-col gap-3">
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
                    Clears: <LocalDateTime value={waiver.waiverAvailableAt} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      </div>
    </LeaguePageShell>
  );
}
