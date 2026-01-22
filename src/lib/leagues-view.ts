import { prisma } from "@/lib/prisma";
import { getActiveMatchWeekForSeason } from "@/lib/matchweek";
import type {
  MyLeagueViewModel,
  OpenLeagueViewModel,
} from "@/components/leagues/types";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatLeagueStatus = (params: {
  matchWeek: { number: number } | null;
  draftScheduledAt: Date | null;
}) => {
  if (params.matchWeek) {
    return `Matchweek ${params.matchWeek.number} active`;
  }
  if (params.draftScheduledAt) {
    return `Draft scheduled ${dateFormatter.format(params.draftScheduledAt)}`;
  }
  return "Draft complete";
};

export async function loadLeaguesView(profileId: string) {
  const memberships = await prisma.leagueMember.findMany({
    where: { profileId },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          season: { select: { id: true, name: true, year: true } },
          draftScheduledAt: true,
          teamCount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const myLeagues: MyLeagueViewModel[] = [];

  for (const membership of memberships) {
    const league = membership.league;
    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId: league.id,
          profileId,
        },
      },
      select: { id: true, name: true },
    });

    const standings = await prisma.leagueTeamRecord.findMany({
      where: { leagueId: league.id },
      orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
      select: { fantasyTeamId: true, points: true },
    });

    const rankIndex = standings.findIndex((record) =>
      record.fantasyTeamId === team?.id,
    );
    const rank = rankIndex === -1 ? standings.length + 1 : rankIndex + 1;
    const totalTeams = Math.max(league.teamCount ?? standings.length ?? 1, 1);

    const matchWeek = league.season
      ? await getActiveMatchWeekForSeason(league.season.id)
      : null;

    const seasonLabel = league.season
      ? league.season.name
        ? `${league.season.year} · ${league.season.name}`
        : `${league.season.year} Season`
      : "Season";

    myLeagues.push({
      league: {
        id: league.id,
        name: league.name,
        seasonLabel,
        inviteCode: league.inviteCode ?? undefined,
      },
      teamName: team?.name,
      standings: { rank, totalTeams },
      statusText: formatLeagueStatus({
        matchWeek,
        draftScheduledAt: league.draftScheduledAt,
      }),
      role: membership.role,
      isOwner: membership.role === "OWNER",
    });
  }

  const openLeagues = await prisma.league.findMany({
    where: {
      joinMode: "OPEN",
      members: {
        none: { profileId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      _count: { select: { teams: true } },
    },
  });

  const openLeagueModels: OpenLeagueViewModel[] = openLeagues.map((league) => ({
    id: league.id,
    name: league.name,
    teamsCount: league._count.teams,
  }));

  return { myLeagues, openLeagues: openLeagueModels };
}
