import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import RosterClient from "./roster-client";
import ScoringCard from "./scoring-card";
import MatchWeekSelector from "./matchweek-selector";
import LineupControls from "./lineup-controls";
import TeamMobileTabs from "./team-mobile-tabs";
import { buildRosterSlots } from "@/lib/roster";
import { getActiveMatchWeekForSeason } from "@/lib/matchweek";
import LeaguePageShell from "@/components/leagues/league-page-shell";
import TeamRenameLink from "@/app/leagues/[leagueId]/team-rename-link";

export const runtime = "nodejs";

type TeamParams = { leagueId: string };

type SlotView = {
  id: string;
  slotNumber: number;
  position: string;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  } | null;
};

type SearchParamsShape = { matchWeek?: string };

export default async function MyTeamRosterPage({
  params,
  searchParams,
}: {
  params: Promise<TeamParams>;
  searchParams?: Promise<SearchParamsShape>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  // Next 16 sometimes provides searchParams as a Promise.
  const sp = searchParams ? await searchParams : undefined;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      rosterSize: true,
      season: { select: { id: true, name: true, year: true } },
    },
  });

  if (!league) notFound();

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
        pageSubtitle="Sign in to manage your roster."
      >
          <AuthButtons isAuthenticated={false} />
      </LeaguePageShell>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
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
        pageSubtitle="You need to join this league before managing your roster."
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

  const team = await prisma.fantasyTeam.findUnique({
    where: {
      leagueId_profileId: { leagueId, profileId: profile.id },
    },
    select: { id: true, name: true },
  });

  if (!team) {
    return (
      <LeaguePageShell
        backHref={`/leagues/${leagueId}`}
        leagueTitle={league.name}
        seasonLabel={`Season ${league.season.name} ${league.season.year}`}
        pageTitle="Team roster"
        pageSubtitle="Create your team from the league page to manage your roster."
        showBadgeTooltip={membership.role === "OWNER"}
      >
        <Link
          href={`/leagues/${leagueId}`}
          className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
        >
          Go to league overview
        </Link>
      </LeaguePageShell>
    );
  }

  // Ensure roster slots exist
  await prisma.rosterSlot.createMany({
    data: buildRosterSlots(team.id, league.id, league.rosterSize),
    skipDuplicates: true,
  });

  const rosterSlots = await prisma.rosterSlot.findMany({
    where: { fantasyTeamId: team.id },
    orderBy: { slotNumber: "asc" },
    select: {
      id: true,
      slotNumber: true,
      position: true,
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

  const matchWeeks = await prisma.matchWeek.findMany({
    where: { seasonId: league.season.id },
    orderBy: { number: "asc" },
    select: { id: true, number: true, status: true },
  });

  const rosterPositionById = new Map(
    rosterSlots.map((slot) => [slot.id, slot.position]),
  );

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
          jerseyNumber: number | null;
          position: string;
          club: { shortName: string | null; slug: string; name: string } | null;
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

  const slots: SlotView[] =
    selectedMatchWeek && selectedMatchWeek.status !== "OPEN"
      ? (lineupSlots ?? []).map((slot) => ({
          id: slot.rosterSlotId,
          slotNumber: slot.slotNumber,
          position: rosterPositionById.get(slot.rosterSlotId) ?? "MID",
          isStarter: slot.isStarter,
          player: slot.player
            ? {
                id: slot.player.id,
                name: slot.player.name,
                jerseyNumber: slot.player.jerseyNumber,
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
            position: slot.position,
            isStarter,
            player: slot.player
              ? {
                  id: slot.player.id,
                  name: slot.player.name,
                  jerseyNumber: slot.player.jerseyNumber,
                  position: slot.player.position,
                  club: slot.player.club,
                }
              : null,
          };
        });

  return (
    <LeaguePageShell
      backHref={`/leagues/${leagueId}`}
      leagueTitle={league.name}
      seasonLabel={`Season ${league.season.name} ${league.season.year}`}
      pageTitle={team.name}
      pageSubtitle={`Manage lineups and roster moves for ${team.name}.`}
      showBadgeTooltip={membership.role === "OWNER"}
      headerContent={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-normal text-[var(--text-muted)]">
          <div className="flex flex-col gap-1">
            <span>Owner: You</span>
            <span className="text-xs uppercase tracking-wide">
              Season: {league.season.name} {league.season.year}
            </span>
          </div>
          <TeamRenameLink leagueId={league.id} initialTeamName={team.name} />
        </div>
      }
    >
      {selectedMatchWeek ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              MatchWeek {selectedMatchWeek.number} · {selectedMatchWeek.status}
            </p>
            <MatchWeekSelector
              matchWeeks={matchWeeks}
              selectedNumber={selectedMatchWeekNumber}
              activeNumber={activeMatchWeek?.number ?? null}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Lineup edits lock based on the active MatchWeek.
          </p>
          {selectedMatchWeek.status !== "OPEN" ? (
            <p className="text-xs text-[var(--text-muted)]">Lineups locked.</p>
          ) : null}
        </div>
      ) : null}

      <TeamMobileTabs
        leagueId={league.id}
        matchWeekNumber={selectedMatchWeekNumber}
        slots={slots}
        isLocked={selectedMatchWeek?.status !== "OPEN"}
      />

      <div className="hidden sm:block">
        <LineupControls
          leagueId={league.id}
          matchWeekNumber={selectedMatchWeekNumber}
          isLocked={selectedMatchWeek?.status !== "OPEN"}
        />

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
    </LeaguePageShell>
  );
}
