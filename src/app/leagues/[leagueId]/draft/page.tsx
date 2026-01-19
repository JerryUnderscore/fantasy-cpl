import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import DraftClient from "./draft-client";
import {
  computeCurrentPick,
  computePickDeadline,
  runDraftCatchUp,
} from "@/lib/draft";

export const runtime = "nodejs";

type DraftParams = { leagueId: string };

// NOTE: Club.shortName is nullable in your DB/schema (string | null).
type DraftPickSummary = {
  id: string;
  pickNumber: number;
  round: number;
  slotInRound: number;
  createdAt: Date;
  fantasyTeamId: string;
  fantasyTeam: { id: string; name: string };
  player: {
    id: string;
    name: string;
    position: string;
    club: { shortName: string | null; slug: string } | null;
  };
};

export default async function DraftPage({
  params,
}: {
  params: DraftParams;
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
            <p className="text-sm text-zinc-500">Sign in to view this league draft.</p>
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
          <h1 className="text-2xl font-semibold text-black">Profile not synced</h1>
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
      season: true,
      seasonId: true,
      draftMode: true,
      draftPickSeconds: true,
    },
  });

  if (!league) notFound();

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
          <h1 className="text-2xl font-semibold text-black">Not a league member</h1>
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
            <h1 className="text-3xl font-semibold text-black">{league.name}</h1>
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

  await runDraftCatchUp({ leagueId });

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true, profileId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const currentTeam =
    teams.find((team) => team.profileId === profile.id) ?? null;

  const draft = await prisma.draft.findUnique({
    where: {
      leagueId_seasonId: { leagueId, seasonId: league.seasonId },
    },
    select: {
      id: true,
      status: true,
      rounds: true,
      createdAt: true,
      currentPickStartedAt: true,
    },
  });

  const picks: DraftPickSummary[] = draft
    ? await prisma.draftPick.findMany({
        where: { draftId: draft.id },
        orderBy: { pickNumber: "asc" },
        select: {
          id: true,
          pickNumber: true,
          round: true,
          slotInRound: true,
          createdAt: true,
          fantasyTeamId: true,
          fantasyTeam: { select: { id: true, name: true } },
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              club: { select: { shortName: true, slug: true } },
            },
          },
        },
      })
    : [];

  const teamCount = teams.length;
  const rounds = draft?.rounds ?? 0;
  const totalPicks = rounds * teamCount;
  const draftedCount = picks.length;
  const remainingPicks =
    totalPicks > 0 ? Math.max(0, totalPicks - draftedCount) : 0;

  let draftStatus: "NOT_STARTED" | "LIVE" | "COMPLETE" = draft
    ? draft.status
    : "NOT_STARTED";

  if (draft && totalPicks > 0 && draftedCount >= totalPicks) {
    draftStatus = "COMPLETE";
  }

  const currentPick = draft
    ? computeCurrentPick(teams, picks, draft.rounds)
    : null;

  const draftDeadline =
    draft && currentPick
      ? computePickDeadline({
          draftStatus,
          draftMode: league.draftMode,
          draftPickSeconds: league.draftPickSeconds,
          currentPickStartedAt: draft.currentPickStartedAt,
          draftCreatedAt: draft.createdAt,
        })
      : null;

  const picksByRoundTeam = new Map<string, DraftPickSummary>();
  picks.forEach((pick) => {
    picksByRoundTeam.set(`${pick.round}-${pick.fantasyTeam.id}`, pick);
  });

  const myTeamPicks = currentTeam
    ? picks.filter((pick) => pick.fantasyTeam.id === currentTeam.id)
    : [];

  const canPick =
    draftStatus === "LIVE" &&
    !!currentTeam &&
    currentPick?.fantasyTeamId === currentTeam.id;

  const draftedPlayerIds = picks.map((pick) => pick.player.id);

  const availablePlayers = draft
    ? await prisma.player.findMany({
        where: {
          seasonId: league.seasonId,
          active: true,
          ...(draftedPlayerIds.length ? { id: { notIn: draftedPlayerIds } } : {}),
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          club: { select: { shortName: true } },
        },
      })
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl bg-white p-8 shadow-sm md:p-10">
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
          onTheClock={
            currentPick
              ? {
                  pickNumber: currentPick.pickNumber,
                  round: currentPick.round,
                  slotInRound: currentPick.slotInRound,
                  fantasyTeamName: currentPick.fantasyTeamName,
                }
              : null
          }
          draftMode={league.draftMode}
          deadline={draftDeadline ? draftDeadline.toISOString() : null}
          canPick={canPick}
          availablePlayers={availablePlayers.map((player) => ({
            id: player.id,
            name: player.name,
            position: player.position,
            club: player.club?.shortName ?? null,
          }))}
        />

        {!draft ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
            <p className="text-base font-semibold text-zinc-800">
              Draft not created yet
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              The commissioner will create the draft when the league is ready.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className="sticky left-0 z-10 w-20 border-b border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Round
                    </th>
                    {teams.map((team) => {
                      const isCurrentUserTeam = currentTeam?.id === team.id;
                      return (
                        <th
                          key={team.id}
                          className={`border-b border-zinc-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                            isCurrentUserTeam ? "bg-sky-50" : "bg-zinc-50"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-zinc-700">{team.name}</span>
                            {isCurrentUserTeam ? (
                              <span className="text-[10px] font-medium text-sky-700">
                                My team
                              </span>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rounds }, (_, index) => index + 1).map(
                    (roundNumber) => (
                      <tr key={roundNumber} className="border-b border-zinc-200">
                        <td className="sticky left-0 z-10 border-b border-zinc-200 bg-white px-3 py-4 text-sm font-semibold text-zinc-700">
                          {roundNumber}
                        </td>
                        {teams.map((team) => {
                          const pick = picksByRoundTeam.get(
                            `${roundNumber}-${team.id}`,
                          );
                          const isCurrentPick =
                            currentPick?.round === roundNumber &&
                            currentPick?.fantasyTeamId === team.id &&
                            draftStatus === "LIVE";
                          const isCurrentUserTeam = currentTeam?.id === team.id;

                          return (
                            <td
                              key={team.id}
                              className={`border-b border-zinc-200 px-4 py-4 align-top text-sm ${
                                isCurrentPick
                                  ? "bg-amber-50"
                                  : isCurrentUserTeam
                                    ? "bg-sky-50"
                                    : "bg-white"
                              }`}
                            >
                              {pick ? (
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-zinc-900">
                                    {pick.player.name}
                                  </span>
                                  <span className="text-xs text-zinc-500">
                                    {pick.player.position} ·{" "}
                                    {pick.player.club?.shortName ?? "—"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-zinc-400">—</span>
                              )}

                              {isCurrentPick ? (
                                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  On the clock
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Draft summary
                </p>
                <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-700">
                  <p>Drafted picks: {draftedCount}</p>
                  <p>Remaining picks: {remainingPicks}</p>
                  <p>Total rounds: {rounds}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  My team
                </p>

                {currentTeam ? (
                  myTeamPicks.length ? (
                    <ul className="mt-3 flex flex-col gap-3">
                      {myTeamPicks.map((pick) => (
                        <li key={pick.id} className="rounded-xl bg-white p-3">
                          <p className="text-sm font-semibold text-zinc-900">
                            {pick.player.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {pick.player.position} ·{" "}
                            {pick.player.club?.shortName ?? "—"}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                            Round {pick.round} · Pick {pick.pickNumber}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">No picks yet.</p>
                  )
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    Join a team to see your draft picks.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
