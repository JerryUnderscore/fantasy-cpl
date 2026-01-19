import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerPosition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import DraftPrepClient from "./draft-prep-client";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function Page({
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
            <h1 className="text-3xl font-semibold text-black">Draft prep</h1>
            <p className="text-sm text-zinc-500">
              Sign in to access draft prep tools.
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
    select: {
      id: true,
      name: true,
      seasonId: true,
      season: { select: { name: true, year: true } },
      rosterSize: true,
      keepersEnabled: true,
      keeperCount: true,
    },
  });

  if (!league) notFound();

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_profileId: { leagueId, profileId: profile.id } },
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
            You need to join this league before accessing draft prep tools.
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
    where: { leagueId_profileId: { leagueId, profileId: profile.id } },
    select: { id: true },
  });

  const rosterSlots = team
    ? await prisma.rosterSlot.findMany({
        where: { fantasyTeamId: team.id },
        select: { position: true },
      })
    : [];

  const positionLimits = rosterSlots.length
    ? rosterSlots.reduce<Record<PlayerPosition, number>>(
        (acc, slot) => {
          acc[slot.position] = (acc[slot.position] ?? 0) + 1;
          return acc;
        },
        {
          GK: 0,
          DEF: 0,
          MID: 0,
          FWD: 0,
        },
      )
    : null;

  const players = await prisma.player.findMany({
    where: { seasonId: league.seasonId, active: true },
    select: {
      id: true,
      name: true,
      position: true,
      club: { select: { shortName: true, name: true } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

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
          <h1 className="text-3xl font-semibold text-black">Draft prep</h1>
          <p className="text-sm text-zinc-500">
            {league.name} - {league.season.name} {league.season.year}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-medium text-zinc-500">
          <span className="rounded-full bg-zinc-900 px-4 py-1.5 text-white">
            Queue
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5">
            My rankings
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5">
            Tiers / Notes
          </span>
        </div>

        <DraftPrepClient
          leagueId={leagueId}
          constraints={{
            rosterSize: league.rosterSize,
            positionLimits,
            keepersEnabled: league.keepersEnabled,
            keeperCount: league.keeperCount,
          }}
          players={players}
        />
      </div>
    </div>
  );
}
