import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import RosterClient from "./roster-client";
import ScoringCard from "./scoring-card";
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

const buildRosterSlots = (fantasyTeamId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

export default async function MyTeamRosterPage({
  params,
}: {
  params: TeamParams | Promise<TeamParams>;
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

  await prisma.rosterSlot.createMany({
    data: buildRosterSlots(team.id),
    skipDuplicates: true,
  });

  const rosterSlots = await prisma.rosterSlot.findMany({
    where: { fantasyTeamId: team.id },
    orderBy: { slotNumber: "asc" },
    select: {
      id: true,
      slotNumber: true,
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

  const slots: SlotView[] = rosterSlots.map((slot) => ({
    id: slot.id,
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
  }));

  const activeMatchWeek = await getActiveMatchWeekForSeason(league.season.id);

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

        {activeMatchWeek ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">
              MatchWeek {activeMatchWeek.number} · {activeMatchWeek.status}
            </p>
            {activeMatchWeek.status !== "OPEN" ? (
              <p className="text-xs text-zinc-600">Lineups locked.</p>
            ) : null}
          </div>
        ) : null}

        <RosterClient leagueId={league.id} initialSlots={slots} />
        <ScoringCard leagueId={league.id} matchWeekNumber={1} />
      </div>
    </div>
  );
}
