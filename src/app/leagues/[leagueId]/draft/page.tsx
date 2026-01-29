import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import DraftClient from "./draft-client";
import DraftPrepClient from "../draft-prep/draft-prep-client";
import {
  computeCurrentPick,
  computePickDeadline,
  runDraftCatchUp,
} from "@/lib/draft";
import { ROSTER_LIMITS } from "@/lib/roster";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";
import LeaguePageHeader from "@/components/leagues/league-page-header";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";
import MyTeamPanel from "./my-team-panel";

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
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
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
      draftScheduledAt: true,
      rosterSize: true,
      keepersEnabled: true,
      keeperCount: true,
    },
  });

  if (!league) notFound();
  if (league.draftMode === "NONE") notFound();

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
            <LeaguePageHeader
              title={league.name}
              leagueName={`Season ${league.season.name} ${league.season.year}`}
              showBadgeTooltip={membership.role === "OWNER"}
            />
            <p className="text-sm text-zinc-500">
              Season: {league.season.name} {league.season.year}
            </p>
            <PageHeader
              title="League draft"
              subtitle="Make picks, manage your queue, and track the draft board."
            />
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

  const positionLimits = ROSTER_LIMITS.min;

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
      isPaused: true,
      pausedRemainingSeconds: true,
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
              jerseyNumber: true,
              position: true,
              club: { select: { shortName: true, slug: true, name: true } },
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
  const onDeckPick =
    currentPick && draft
      ? computeCurrentPick(
          teams,
          [
            ...picks.map((pick) => ({
              pickNumber: pick.pickNumber,
              fantasyTeamId: pick.fantasyTeamId,
            })),
            {
              pickNumber: currentPick.pickNumber,
              fantasyTeamId: currentPick.fantasyTeamId,
            },
          ],
          draft.rounds,
        )
      : null;

  const draftDeadline =
    draft && currentPick
      ? computePickDeadline({
          draftStatus,
          draftMode: league.draftMode,
          draftPickSeconds: league.draftPickSeconds,
          currentPickStartedAt: draft.currentPickStartedAt,
          draftCreatedAt: draft.createdAt,
          isPaused: draft.isPaused,
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
    currentPick?.fantasyTeamId === currentTeam.id &&
    !draft?.isPaused;

  const draftedPlayerIds = picks.map((pick) => pick.player.id);

  const queuePlayers = await prisma.player.findMany({
    where: {
      seasonId: league.seasonId,
      active: true,
      ...(draftedPlayerIds.length ? { id: { notIn: draftedPlayerIds } } : {}),
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      jerseyNumber: true,
      position: true,
      club: { select: { shortName: true, name: true, slug: true } },
    },
  });

  const rosterSlots = currentTeam
    ? await prisma.rosterSlot.findMany({
        where: { fantasyTeamId: currentTeam.id, playerId: { not: null } },
        select: { player: { select: { position: true } } },
      })
    : [];

  const rosterCounts = rosterSlots.reduce(
    (acc, slot) => {
      const position = slot.player?.position;
      if (position) {
        acc[position] += 1;
      }
      return acc;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );

  const queueItems =
    draft && currentTeam
      ? await prisma.draftQueueItem.findMany({
          where: { draftId: draft.id, fantasyTeamId: currentTeam.id },
          orderBy: { rank: "asc" },
          select: { playerId: true },
        })
      : [];

  const queuePlayerIds = queueItems.map((item) => item.playerId);

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
          <LeaguePageHeader
            title={league.name}
            leagueName={`Season ${league.season.name} ${league.season.year}`}
            showBadgeTooltip={membership.role === "OWNER"}
          />
          <p className="text-sm text-zinc-500">
            {league.season.name} {league.season.year}
          </p>
          <PageHeader
            title="League draft"
            subtitle="Make picks, manage your queue, and track the draft board."
          />
        </div>

        <DraftClient
          leagueId={leagueId}
          draftId={draft?.id ?? null}
          isOwner={membership.role === "OWNER"}
          draftStatus={draftStatus}
          isPaused={draft?.isPaused ?? false}
          pausedRemainingSeconds={draft?.pausedRemainingSeconds ?? null}
          queuedPlayerIds={queuePlayerIds}
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
          onDeck={
            onDeckPick
              ? {
                  pickNumber: onDeckPick.pickNumber,
                  round: onDeckPick.round,
                  slotInRound: onDeckPick.slotInRound,
                  fantasyTeamName: onDeckPick.fantasyTeamName,
                }
              : null
          }
          totalPicks={totalPicks}
          draftMode={league.draftMode}
          deadline={draftDeadline ? draftDeadline.toISOString() : null}
          scheduledAt={league.draftScheduledAt?.toISOString() ?? null}
          canPick={canPick}
          availablePlayers={queuePlayers.map((player) => ({
            id: player.id,
            name: player.name,
            jerseyNumber: player.jerseyNumber,
            position: player.position,
            club: player.club
              ? getClubDisplayName(player.club.slug, player.club.name)
              : null,
          }))}
        />

        {draftStatus !== "LIVE" || draft?.isPaused ? (
          <SectionCard title="Draft status">
            <p className="text-sm text-[var(--text-muted)]">
              {draftStatus === "NOT_STARTED"
                ? "The draft hasn’t started yet. The commissioner will open it when the league is ready."
                : draftStatus === "COMPLETE"
                  ? "The draft is complete. You can review picks below."
                  : draft?.isPaused
                    ? "The draft is paused. Picks will resume once it is unpaused."
                    : "Draft status is pending."}
            </p>
          </SectionCard>
        ) : null}

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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)]">
            <SectionCard
              title="Draft board"
              description={`${draftedCount} picks · ${remainingPicks} remaining`}
            >
              <div className="max-h-[520px] overflow-auto rounded-2xl border border-[var(--border)] bg-white">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[var(--surface2)]">
                      <th className="sticky left-0 z-10 w-20 border-b border-[var(--border)] bg-[var(--surface2)] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Round
                      </th>
                      {teams.map((team) => {
                        const isCurrentUserTeam = currentTeam?.id === team.id;
                        return (
                          <th
                            key={team.id}
                            className={`border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] ${
                              isCurrentUserTeam
                                ? "bg-sky-50"
                                : "bg-[var(--surface2)]"
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
                          <td className="sticky left-0 z-10 border-b border-[var(--border)] bg-white px-3 py-4 text-sm font-semibold text-zinc-700">
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
                            const isCurrentUserTeam =
                              currentTeam?.id === team.id;

                            return (
                              <td
                                key={team.id}
                                className={`border-b border-[var(--border)] px-4 py-4 align-top text-xs ${
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
                                      {formatPlayerName(
                                        pick.player.name,
                                        pick.player.jerseyNumber,
                                      )}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                      {pick.player.position} ·{" "}
                                      {pick.player.club
                                        ? getClubDisplayName(
                                            pick.player.club.slug,
                                            pick.player.club.name,
                                          )
                                        : "—"}
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
            </SectionCard>

            <div className="flex flex-col gap-6">
              <SectionCard title="Draft summary">
                <div className="flex flex-col gap-2 text-sm text-zinc-700">
                  <p>Drafted picks: {draftedCount}</p>
                  <p>Remaining picks: {remainingPicks}</p>
                  <p>Total rounds: {rounds}</p>
                </div>
              </SectionCard>

              {currentTeam ? (
                <MyTeamPanel picks={myTeamPicks} />
              ) : (
                <SectionCard title="My team">
                  <p className="text-sm text-[var(--text-muted)]">
                    Join a team to see your draft picks.
                  </p>
                </SectionCard>
              )}
            </div>
          </div>
        )}

        <DraftPrepClient
          leagueId={leagueId}
          constraints={{
            rosterSize: league.rosterSize,
            positionLimits,
            rosterCounts,
            maxGoalkeepers: ROSTER_LIMITS.max.GK ?? 1,
            keepersEnabled: league.keepersEnabled,
            keeperCount: league.keeperCount,
          }}
          players={queuePlayers}
        />
      </div>
    </div>
  );
}
