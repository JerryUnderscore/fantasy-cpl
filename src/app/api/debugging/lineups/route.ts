import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const parseMatchWeekNumber = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId");
    const teamId = request.nextUrl.searchParams.get("teamId");
    const matchWeekNumber = parseMatchWeekNumber(
      request.nextUrl.searchParams.get("matchWeek"),
    );

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId is required" },
        { status: 400 },
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        seasonId: true,
        season: { select: { name: true, year: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const matchWeeks = await prisma.matchWeek.findMany({
      where: {
        seasonId: league.seasonId,
        ...(matchWeekNumber ? { number: matchWeekNumber } : {}),
      },
      orderBy: { number: "asc" },
      select: { id: true, number: true, status: true },
    });

    if (matchWeekNumber && matchWeeks.length === 0) {
      return NextResponse.json(
        { error: "MatchWeek not found" },
        { status: 404 },
      );
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId, ...(teamId ? { id: teamId } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    if (teamId && teams.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const rosterSlots = await prisma.rosterSlot.findMany({
      where: { leagueId },
      orderBy: [{ fantasyTeamId: "asc" }, { slotNumber: "asc" }],
      select: {
        id: true,
        fantasyTeamId: true,
        slotNumber: true,
        playerId: true,
        player: { select: { name: true, position: true } },
      },
    });

    const rosterByTeam = new Map<string, typeof rosterSlots>();
    for (const slot of rosterSlots) {
      const list = rosterByTeam.get(slot.fantasyTeamId) ?? [];
      list.push(slot);
      rosterByTeam.set(slot.fantasyTeamId, list);
    }

    const matchWeekIds = matchWeeks.map((week) => week.id);
    const lineupSlots = matchWeekIds.length
      ? await prisma.teamMatchWeekLineupSlot.findMany({
          where: {
            matchWeekId: { in: matchWeekIds },
            fantasyTeamId: { in: teams.map((team) => team.id) },
          },
          orderBy: [
            { fantasyTeamId: "asc" },
            { matchWeekId: "asc" },
            { slotNumber: "asc" },
          ],
          select: {
            id: true,
            fantasyTeamId: true,
            matchWeekId: true,
            slotNumber: true,
            rosterSlotId: true,
            playerId: true,
            isStarter: true,
            player: { select: { name: true, position: true } },
          },
        })
      : [];

    const lineupByTeamAndWeek = new Map<string, typeof lineupSlots>();
    for (const slot of lineupSlots) {
      const key = `${slot.fantasyTeamId}:${slot.matchWeekId}`;
      const list = lineupByTeamAndWeek.get(key) ?? [];
      list.push(slot);
      lineupByTeamAndWeek.set(key, list);
    }

    const responseTeams = teams.map((team) => {
      const roster = (rosterByTeam.get(team.id) ?? []).map((slot) => ({
        id: slot.id,
        slotNumber: slot.slotNumber,
        playerId: slot.playerId,
        playerName: slot.player?.name ?? null,
        position: slot.player?.position ?? null,
      }));

      const lineups = matchWeeks.map((matchWeek) => ({
        matchWeek: {
          id: matchWeek.id,
          number: matchWeek.number,
          status: matchWeek.status,
        },
        slots: (lineupByTeamAndWeek.get(
          `${team.id}:${matchWeek.id}`,
        ) ?? []).map((slot) => ({
          id: slot.id,
          rosterSlotId: slot.rosterSlotId,
          slotNumber: slot.slotNumber,
          playerId: slot.playerId,
          playerName: slot.player?.name ?? null,
          position: slot.player?.position ?? null,
          isStarter: slot.isStarter,
        })),
      }));

      return { team, roster, lineups };
    });

    return NextResponse.json({
      ok: true,
      league: {
        id: league.id,
        name: league.name,
        season: league.season,
      },
      matchWeeks,
      teams: responseTeams,
    });
  } catch (error) {
    console.error("debug lineups route error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
