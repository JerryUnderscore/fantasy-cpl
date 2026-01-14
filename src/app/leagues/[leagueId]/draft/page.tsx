// Manual test: 1) Owner clicks Start draft and sees status Live. 2) On-the-clock owner drafts a player and sees pick + roster update. 3) Non-on-the-clock member sees disabled Draft buttons.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import DraftClient from "./draft-client";

export const runtime = "nodejs";

type DraftParams = { leagueId: string };

export default async function DraftPage({
  params,
}: {
  params: DraftParams | Promise<DraftParams>;
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
            <h1 className="text-3xl font-semibold text-black">League draft</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view this league draft.
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
    select: { id: true, name: true, season: true, seasonId: true },
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
            You need to join this league before viewing its draft.
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

  if (!league.season.isActive) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <Link
              href={`/leagues/${leagueId}`}
              className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
            >
              Back to league
            </Link>
            <h1 className="text-3xl font-semibold text-black">
              {league.name}
            </h1>
            <p className="text-sm text-zinc-500">
              {league.season.name} · {league.season.year}
            </p>
          </div>
          <p className="text-sm text-zinc-600">
            Drafting is only available during an active season.
          </p>
        </div>
      </div>
    );
  }

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true, profileId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const currentTeam = teams.find((team) => team.profileId === profile.id) ?? null;

  const draft = await prisma.draft.findUnique({
    where: {
      leagueId_seasonId: { leagueId, seasonId: league.seasonId },
    },
    select: { id: true, status: true, rounds: true },
  });

  const picks = draft
    ? await prisma.draftPick.findMany({
        where: { draftId: draft.id },
        orderBy: { pickNumber: "asc" },
        include: {
          fantasyTeam: { select: { name: true } },
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              club: { select: { shortName: true } },
            },
          },
        },
      })
    : [];

  const teamCount = teams.length;
  const totalPicks = draft ? draft.rounds * teamCount : 0;
  const pickNumber = picks.length + 1;

  let draftStatus: "NOT_STARTED" | "LIVE" | "COMPLETE" = draft
    ? draft.status
    : "NOT_STARTED";
  let onTheClock: {
    fantasyTeamId: string;
    name: string;
    pickNumber: number;
    round: number;
    slotInRound: number;
  } | null = null;

  if (draft && teamCount && pickNumber > totalPicks) {
    draftStatus = "COMPLETE";
  } else if (draft && draft.status === "LIVE" && teamCount) {
    const round = Math.ceil(pickNumber / teamCount);
    const slotInRound = ((pickNumber - 1) % teamCount) + 1;
    const teamIndex =
      round % 2 === 1 ? slotInRound - 1 : teamCount - slotInRound;
    const team = teams[teamIndex];
    if (team) {
      onTheClock = {
        fantasyTeamId: team.id,
        name: team.name,
        pickNumber,
        round,
        slotInRound,
      };
    }
  }

  const draftedPlayerIds = picks.map((pick) => pick.player.id);
  const availablePlayers = await prisma.player.findMany({
    where: {
      seasonId: league.seasonId,
      ...(draftedPlayerIds.length ? { id: { notIn: draftedPlayerIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      club: { select: { shortName: true } },
    },
  });

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
          <h1 className="text-3xl font-semibold text-black">League draft</h1>
          <p className="text-sm text-zinc-500">
            {league.name} · {league.season.name} {league.season.year}
          </p>
        </div>

        <DraftClient
          leagueId={leagueId}
          isOwner={membership.role === "OWNER"}
          draftStatus={draftStatus}
          onTheClock={onTheClock}
          picks={picks.map((pick) => ({
            id: pick.id,
            pickNumber: pick.pickNumber,
            round: pick.round,
            slotInRound: pick.slotInRound,
            teamName: pick.fantasyTeam.name,
            player: {
              name: pick.player.name,
              position: pick.player.position,
              club: pick.player.club?.shortName ?? null,
            },
          }))}
          availablePlayers={availablePlayers.map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position,
            club: player.club?.shortName ?? null,
          }))}
          canPick={
            draftStatus === "LIVE" &&
            !!currentTeam &&
            onTheClock?.fantasyTeamId === currentTeam.id
          }
        />
      </div>
    </div>
  );
}
