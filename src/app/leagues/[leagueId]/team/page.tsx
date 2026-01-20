import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import RosterClient from "./roster-client";
import ScoringCard from "./scoring-card";
import MatchWeekSelector from "./matchweek-selector";
import { PlayerPosition } from "@prisma/client";
import { getActiveMatchWeekForSeason } from "@/lib/matchweek";

export const runtime = "nodejs";

type TeamParams = { leagueId: string };

type SlotView = {
  id: string;
  slotNumber: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  } | null;
};

const ROSTER_SIZE = 15;

const buildRosterSlots = (fantasyTeamId: string, leagueId: string) =>
  Array.from({ length: ROSTER_SIZE }, (_, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

type SearchParamsShape = { matchWeek?: string };

export default async function MyTeamRosterPage({
  params,
  searchParams,
}: {
  params: Promise<TeamParams>;
  searchParams?: SearchParamsShape | Promise<SearchParamsShape>;
}) {
  const { leagueId } = await params;
    if (!leagueId) notFound();

  // Next 16 sometimes provides searchParams as a Promise.
  const sp = searchParams ? await searchParams : undefined;

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
              Sign in to manage your roster.
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
            You need to join this league before managing your roster.
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

  const team = await prisma.fantasyTeam.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true, name: true },
  });

  if (!team) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">No team yet</h1>
          <p className="text-sm text-zinc-500">
            Create your team from the league page to manage your roster.
          </p>
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

  // Ensure roster slots exist
  await prisma.rosterSlot.createMany({
    data: buildRosterSlots(team.id, league.id),
    skipDuplicates: true,
  });

  const rosterSlots = await prisma.rosterSlot.findMany({
    where: { fantasyTeamId: team.id },
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
          position: true,
          club: { select: { shortName: true, slug: true } },
        },
      },
    },
  });

  const matchWeeks = await prisma.matchWeek.findMany({
    where: { seasonId: league.season.id },
    orderBy: { number: "asc" },
    select: { id: true, number: true, status: true },
  });

  const activeMatchWeek = await getActiveMatchWeekForSeason(league.season.id);

  const requestedMatchWeek = Number(sp?.matchWeek);
  const requestedMatchWeekNumber =
    Number.isInteger(requestedMatchWeek) && requestedMatchWeek > 0
      ? requestedMatchWeek
      : null;

  const selectedMatchWeek =
    matchWeeks.find((week) => week.number === requestedMatchWeekNumber) ??
    activeMatchWeek ??
    matchWeeks[0] ??
    null;

  const selectedMatchWeekNumber = selectedMatchWeek?.number ?? 1;

  let lineupSlots:
    | Array<{
        rosterSlotId: string;
        slotNumber: number;
        playerId: string | null;
        isStarter: boolean;
        player: {
          id: string;
          name: string;
          position: string;
          club: { shortName: string | null; slug: string } | null;
        } | null;
      }>
    | null = null;

  if (selectedMatchWeek) {
    const existingLineupSlots = await prisma.teamMatchWeekLineupSlot.findMany({
      where: { fantasyTeamId: team.id, matchWeekId: selectedMatchWeek.id },
      select: { rosterSlotId: true },
    });
    const existingSlotIds = new Set(
      existingLineupSlots.map((slot) => slot.rosterSlotId),
    );
    const missingSlots = rosterSlots.filter(
      (slot) => !existingSlotIds.has(slot.id),
    );

    const priorMatchWeek = await prisma.teamMatchWeekLineupSlot.findMany({
      where: {
        fantasyTeamId: team.id,
        matchWeek: {
          seasonId: league.season.id,
          number: { lt: selectedMatchWeek.number },
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
          matchWeekId: selectedMatchWeek.id,
          rosterSlotId: slot.id,
          slotNumber: slot.slotNumber,
          playerId: slot.playerId ?? null,
          isStarter: seedStarterMap?.get(slot.id) ?? slot.isStarter,
        })),
      });
    }

    lineupSlots = await prisma.teamMatchWeekLineupSlot.findMany({
      where: { fantasyTeamId: team.id, matchWeekId: selectedMatchWeek.id },
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
            position: true,
            club: { select: { shortName: true, slug: true } },
          },
        },
      },
    });
  }

  const lineupBySlotId = new Map(
    (lineupSlots ?? []).map((slot) => [slot.rosterSlotId, slot]),
  );

  const slots: SlotView[] =
    selectedMatchWeek && selectedMatchWeek.status !== "OPEN"
      ? (lineupSlots ?? []).map((slot) => ({
          id: slot.rosterSlotId,
          slotNumber: slot.slotNumber,
          isStarter: slot.isStarter,
          player: slot.player
            ? {
                id: slot.player.id,
                name: slot.player.name,
                position: slot.player.position,
                club: slot.player.club,
              }
            : null,
        }))
      : rosterSlots.map((slot) => {
          const lineup = lineupBySlotId.get(slot.id);
          const isStarter =
            Boolean(lineup) &&
            lineup?.playerId === slot.playerId &&
            Boolean(lineup?.isStarter);

          return {
            id: slot.id,
            slotNumber: slot.slotNumber,
            isStarter,
            player: slot.player
              ? {
                  id: slot.player.id,
                  name: slot.player.name,
                  position: slot.player.position,
                  club: slot.player.club,
                }
              : null,
          };
        });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to league
          </Link>
          <h1 className="text-3xl font-semibold text-black">{team.name}</h1>
          <p className="text-sm text-zinc-500">
            {league.name} · {league.season.name} {league.season.year}
          </p>
        </div>

        {selectedMatchWeek ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900">
                MatchWeek {selectedMatchWeek.number} · {selectedMatchWeek.status}
              </p>
              <MatchWeekSelector
                matchWeeks={matchWeeks}
                selectedNumber={selectedMatchWeekNumber}
                activeNumber={activeMatchWeek?.number ?? null}
              />
            </div>
            <p className="text-xs text-zinc-500">
              Lineup edits lock based on the active MatchWeek.
            </p>
            {selectedMatchWeek.status !== "OPEN" ? (
              <p className="text-xs text-zinc-600">Lineups locked.</p>
            ) : null}
          </div>
        ) : null}

        <RosterClient
          leagueId={league.id}
          initialSlots={slots}
          matchWeekNumber={selectedMatchWeekNumber}
          isLocked={selectedMatchWeek?.status !== "OPEN"}
        />
        <ScoringCard
          leagueId={league.id}
          matchWeekNumber={selectedMatchWeekNumber}
        />
      </div>
    </div>
  );
}
