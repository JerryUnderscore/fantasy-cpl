import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import { getActiveMatchWeekForSeason } from "@/lib/matchweek";
import TradeRosterClient from "./trade-roster-client";
import LeaguePageShell from "@/components/leagues/league-page-shell";

export const runtime = "nodejs";

type TeamParams = { leagueId: string; teamId: string };

type SlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  } | null;
};

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<TeamParams>;
}) {
  const { leagueId, teamId } = await params;
  if (!leagueId || !teamId) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, season: true },
  });

  if (!league) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LeaguePageShell
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Team roster"
        pageSubtitle="Sign in to view this team roster."
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
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Team roster"
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
    select: { id: true, role: true },
  });

  if (!membership) {
    return (
      <LeaguePageShell
        backHref="/leagues"
        backLabel="Back to leagues"
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Team roster"
        pageSubtitle="You need to join this league before viewing its teams."
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

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId },
    include: {
      profile: { select: { displayName: true } },
      rosterSlots: {
        orderBy: { slotNumber: "asc" },
        select: {
          id: true,
          slotNumber: true,
          playerId: true,
          isStarter: true,
          player: {
            select: {
              id: true,
              name: true,
              jerseyNumber: true,
              position: true,
              club: { select: { shortName: true, slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!team) {
    notFound();
  }

  const viewerTeam = await prisma.fantasyTeam.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true, name: true },
  });

  const viewerRoster = viewerTeam
    ? await prisma.rosterSlot.findMany({
        where: { fantasyTeamId: viewerTeam.id, playerId: { not: null } },
        select: {
          player: {
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

  const viewerPlayers = viewerRoster
    .map((slot) => slot.player)
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  const activeMatchWeek = await getActiveMatchWeekForSeason(league.season.id);
  let lineupSlots:
    | Array<{
        rosterSlotId: string;
        slotNumber: number;
        playerId: string | null;
        isStarter: boolean;
        player: SlotView["player"];
      }>
    | null = null;

  if (activeMatchWeek) {
    const existingLineupSlots = await prisma.teamMatchWeekLineupSlot.findMany({
      where: { fantasyTeamId: team.id, matchWeekId: activeMatchWeek.id },
      select: { rosterSlotId: true },
    });
    const existingSlotIds = new Set(
      existingLineupSlots.map((slot) => slot.rosterSlotId),
    );
    const missingSlots = team.rosterSlots.filter(
      (slot) => !existingSlotIds.has(slot.id),
    );

    const priorMatchWeek = await prisma.teamMatchWeekLineupSlot.findMany({
      where: {
        fantasyTeamId: team.id,
        matchWeek: {
          seasonId: league.season.id,
          number: { lt: activeMatchWeek.number },
        },
      },
      distinct: ["matchWeekId"],
      orderBy: { matchWeek: { number: "desc" } },
      take: 1,
      select: { matchWeekId: true },
    });
    const priorMatchWeekId = priorMatchWeek[0]?.matchWeekId ?? null;
    const seedStarterMap = priorMatchWeekId
      ? new Map(
          (
            await prisma.teamMatchWeekLineupSlot.findMany({
              where: { fantasyTeamId: team.id, matchWeekId: priorMatchWeekId },
              select: { rosterSlotId: true, isStarter: true },
            })
          ).map((slot) => [slot.rosterSlotId, slot.isStarter]),
        )
      : null;

    if (missingSlots.length > 0) {
      await prisma.teamMatchWeekLineupSlot.createMany({
        data: missingSlots.map((slot) => ({
          fantasyTeamId: team.id,
          matchWeekId: activeMatchWeek.id,
          rosterSlotId: slot.id,
          slotNumber: slot.slotNumber,
          playerId: slot.playerId ?? null,
          isStarter: seedStarterMap?.get(slot.id) ?? slot.isStarter,
        })),
      });
    }

    lineupSlots = await prisma.teamMatchWeekLineupSlot.findMany({
      where: { fantasyTeamId: team.id, matchWeekId: activeMatchWeek.id },
      orderBy: { slotNumber: "asc" },
      select: {
        rosterSlotId: true,
        slotNumber: true,
        playerId: true,
        isStarter: true,
        player: {
          select: {
            id: true,
            name: true,
            jerseyNumber: true,
            position: true,
            club: { select: { shortName: true, slug: true, name: true } },
          },
        },
      },
    });
  }

  const lineupBySlotId = new Map(
    (lineupSlots ?? []).map((slot) => [slot.rosterSlotId, slot]),
  );

  const slotMap = new Map<number, SlotView>();
  team.rosterSlots.forEach((slot) => {
    const lineup = lineupBySlotId.get(slot.id);
    const isStarter =
      Boolean(lineup) &&
      lineup?.playerId === slot.playerId &&
      Boolean(lineup?.isStarter);

    slotMap.set(slot.slotNumber, {
      id: slot.id,
      slotNumber: slot.slotNumber,
      isStarter,
      player: slot.player,
    });
  });

  const roster: SlotView[] = Array.from({ length: 15 }, (_, index) => {
    const slotNumber = index + 1;
    return (
      slotMap.get(slotNumber) ?? {
        id: `empty-${slotNumber}`,
        slotNumber,
        isStarter: false,
        player: null,
      }
    );
  });

  const starters = roster.filter((slot) => slot.isStarter);
  const bench = roster.filter((slot) => !slot.isStarter);
  const targetPlayers = roster
    .map((slot) => slot.player)
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const allowTrade = Boolean(viewerTeam && viewerTeam.id !== team.id);

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueId}`}
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle="Team roster"
      pageSubtitle={`Roster view for ${team.name}.`}
      showBadgeTooltip={membership.role === "OWNER"}
      headerContent={
        <div className="flex flex-col gap-1 text-sm font-normal text-[var(--text-muted)]">
          <span>Owner: {team.profile.displayName ?? "Unknown"}</span>
          <span className="text-xs uppercase tracking-wide">
            Season: {league.season.name} {league.season.year}
          </span>
        </div>
      }
    >
      <TradeRosterClient
        leagueId={leagueId}
        allowTrade={allowTrade}
        targetTeam={{ id: team.id, name: team.name }}
        viewerTeam={viewerTeam}
        starters={starters}
        bench={bench}
        viewerPlayers={viewerPlayers}
        targetPlayers={targetPlayers}
      />
    </LeaguePageShell>
  );
}
