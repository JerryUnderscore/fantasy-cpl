import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import PlayersClient from "./players-client";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function LeaguePlayersPage({
  params,
}: {
  params: LeagueParams;
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
            <h1 className="text-3xl font-semibold text-black">Players</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view league players.
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
            You need to join this league before viewing its players.
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
          <h1 className="text-3xl font-semibold text-black">Players</h1>
          <p className="text-sm text-zinc-500">
            {league.name} · {league.season.name} {league.season.year}
          </p>
        </div>

        <PlayersClient leagueId={league.id} />
      </div>
    </div>
  );
}
