import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import ScoringAdminClient from "./scoring-admin-client";

export const runtime = "nodejs";

export default async function ScoringAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-black">
              Scoring admin
            </h1>
            <p className="text-sm text-zinc-600">
              Sign in to manage match stats.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-black hover:underline"
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
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Profile not synced
          </h1>
          <p className="text-sm text-zinc-600">
            Please sync your profile from the home page and try again.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-black hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { year: "desc" },
  });

  if (!season) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            No active season
          </h1>
          <p className="text-sm text-zinc-600">
            Create or activate a season before editing stats.
          </p>
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  const players = await prisma.player.findMany({
    where: { seasonId: season.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      club: { select: { shortName: true, slug: true } },
    },
  });

  const matchWeeks = await prisma.matchWeek.findMany({
    where: { seasonId: season.id },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true, status: true },
  });

  const seasons = await prisma.season.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true, isActive: true },
  });

  const clubs = await prisma.club.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true, shortName: true },
  });

  const playerOptions = players.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    clubLabel: player.club?.shortName ?? player.club?.slug ?? "",
  }));

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const isAdmin =
    profile.isAdmin ||
    (adminEmail && user.email && user.email.toLowerCase() === adminEmail);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
          <h1 className="text-3xl font-semibold text-black">Scoring admin</h1>
          <p className="text-sm text-zinc-600">
            {season.name} · {season.year}
          </p>
          <p className="text-xs text-zinc-700">
            Updates apply to all leagues in this season.
          </p>
        </div>

        <ScoringAdminClient
          postUrl="/api/scoring/stats"
          players={playerOptions}
          matchWeeks={matchWeeks}
          seasons={seasons}
          clubs={clubs}
          canWrite={process.env.ALLOW_DEV_STAT_WRITES === "true"}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
