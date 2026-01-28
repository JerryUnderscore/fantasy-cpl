import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import { getActiveMatchWeekForSeason } from "@/lib/matchweek";
import TradeRosterClient from "./trade-roster-client";
import LeaguePageHeader from "@/components/leagues/league-page-header";
import PageHeader from "@/components/layout/page-header";

export const runtime = "nodejs";

type TeamParams = { leagueId: string; teamId: string };

type SlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null } | null;
  } | null;
};

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<TeamParams>;
}) {
  const { leagueId, teamId } = await params;
    if (!leagueId || !teamId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-black">Team roster</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view this team roster.
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
    select: { id: true, name: true, season: true },
  });

  if (!league) {
    notFound();
  }

  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true, role: true },
  });

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
              name: true,
              jerseyNumber: true,
              position: true,
              club: { select: { shortName: true } },
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
              club: { select: { shortName: true } },
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
            name: true,
            jerseyNumber: true,
            position: true,
            club: { select: { shortName: true } },
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
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
          <LeaguePageHeader
            title={league.name}
            leagueName={`Season ${league.season.name} ${league.season.year}`}
            showBadgeTooltip={membership.role === "OWNER"}
          />
          <PageHeader
            title="Team roster"
            subtitle={`Roster view for ${team.name}.`}
          />
          <p className="text-sm text-zinc-500">
            Owner: {team.profile.displayName ?? "Unknown"}
          </p>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Season: {league.season.name} {league.season.year}
          </p>
        </div>

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
      </div>
    </div>
  );
}
