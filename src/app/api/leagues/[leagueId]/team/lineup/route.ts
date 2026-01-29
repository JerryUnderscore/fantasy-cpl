import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const STARTERS_REQUIRED = 11;

const MIN_POSITION_COUNTS = {
  GK_MAX: 1,
  DEF_MIN: 3,
  MID_MIN: 3,
  FWD_MIN: 1,
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

const parseMatchWeekNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const matchWeekNumber = parseMatchWeekNumber(body?.matchWeekNumber);

    if (!matchWeekNumber) {
      return NextResponse.json(
        { error: "matchWeekNumber is required" },
        { status: 400 },
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { seasonId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const matchWeek = await prisma.matchWeek.findUnique({
      where: {
        seasonId_number: {
          seasonId: league.seasonId,
          number: matchWeekNumber,
        },
      },
      select: { id: true, status: true, number: true },
    });

    if (!matchWeek) {
      return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
    }

    if (matchWeek.status !== "OPEN") {
      return NextResponse.json(
        { error: "Lineups are locked for this MatchWeek" },
        { status: 409 },
      );
    }

    const lineupCount = await prisma.teamMatchWeekLineupSlot.count({
      where: { fantasyTeamId: team.id, matchWeekId: matchWeek.id },
    });

    if (lineupCount === 0) {
      const rosterSlots = await prisma.rosterSlot.findMany({
        where: { fantasyTeamId: team.id },
        select: { id: true, slotNumber: true, playerId: true, isStarter: true },
      });

      const priorMatchWeek = await prisma.teamMatchWeekLineupSlot.findMany({
        where: {
          fantasyTeamId: team.id,
          matchWeek: {
            seasonId: league.seasonId,
            number: { lt: matchWeek.number },
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

      if (rosterSlots.length > 0) {
        await prisma.teamMatchWeekLineupSlot.createMany({
          data: rosterSlots.map((slot) => ({
            fantasyTeamId: team.id,
            matchWeekId: matchWeek.id,
            rosterSlotId: slot.id,
            slotNumber: slot.slotNumber,
            playerId: slot.playerId ?? null,
            isStarter: seedStarterMap?.get(slot.id) ?? slot.isStarter,
          })),
        });
      }
    }

    const starters = await prisma.teamMatchWeekLineupSlot.findMany({
      where: {
        fantasyTeamId: team.id,
        matchWeekId: matchWeek.id,
        isStarter: true,
      },
      select: {
        playerId: true,
        player: { select: { position: true } },
      },
    });

    const startersWithPlayers = starters.filter((slot) => slot.playerId);

    if (starters.length !== startersWithPlayers.length) {
      return NextResponse.json(
        { error: "Starter slot is missing a player" },
        { status: 400 },
      );
    }

    if (startersWithPlayers.length !== STARTERS_REQUIRED) {
      return NextResponse.json(
        {
          error: "Invalid starters",
          details: {
            required: STARTERS_REQUIRED,
            current: startersWithPlayers.length,
          },
        },
        { status: 400 },
      );
    }

    const positionCounts = startersWithPlayers.reduce(
      (acc, slot) => {
        const pos = slot.player?.position;
        if (pos === "GK") acc.GK += 1;
        if (pos === "DEF") acc.DEF += 1;
        if (pos === "MID") acc.MID += 1;
        if (pos === "FWD") acc.FWD += 1;
        return acc;
      },
      { GK: 0, DEF: 0, MID: 0, FWD: 0 },
    );

    if (positionCounts.GK > MIN_POSITION_COUNTS.GK_MAX) {
      return NextResponse.json(
        {
          error: "Too many goalkeepers",
          details: positionCounts,
        },
        { status: 400 },
      );
    }

    if (positionCounts.DEF < MIN_POSITION_COUNTS.DEF_MIN) {
      return NextResponse.json(
        {
          error: "Not enough defenders",
          details: positionCounts,
        },
        { status: 400 },
      );
    }

    if (positionCounts.MID < MIN_POSITION_COUNTS.MID_MIN) {
      return NextResponse.json(
        {
          error: "Not enough midfielders",
          details: positionCounts,
        },
        { status: 400 },
      );
    }

    if (positionCounts.FWD < MIN_POSITION_COUNTS.FWD_MIN) {
      return NextResponse.json(
        {
          error: "Not enough forwards",
          details: positionCounts,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/team/lineup error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
