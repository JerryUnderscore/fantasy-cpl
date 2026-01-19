import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";

export const runtime = "nodejs";

type PlayerStat = {
  playerId: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  cleanSheet: boolean;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const matchWeekId = searchParams.get("matchWeekId");

    if (!matchWeekId) {
      return NextResponse.json(
        { error: "matchWeekId is required" },
        { status: 400 },
      );
    }

    const matchWeek = await prisma.matchWeek.findUnique({
      where: { id: matchWeekId },
      select: { id: true, number: true, seasonId: true },
    });

    if (!matchWeek) {
      return NextResponse.json({ error: "MatchWeek not found" }, { status: 404 });
    }

    const matches = await prisma.match.findMany({
      where: { matchWeekId },
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true,
        kickoffAt: true,
        status: true,
        homeClub: { select: { id: true, slug: true, shortName: true, name: true } },
        awayClub: { select: { id: true, slug: true, shortName: true, name: true } },
      },
    });

    if (!matches.length) {
      return NextResponse.json({ matchWeek, matches: [] });
    }

    const clubIds = Array.from(
      new Set(matches.flatMap((match) => [match.homeClub.id, match.awayClub.id])),
    );

    const players = await prisma.player.findMany({
      where: {
        seasonId: matchWeek.seasonId,
        clubId: { in: clubIds },
        active: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        position: true,
        clubId: true,
        club: { select: { slug: true, shortName: true, name: true } },
      },
    });

    const stats = await prisma.playerMatchStat.findMany({
      where: { matchWeekId, playerId: { in: players.map((p) => p.id) } },
      select: {
        playerId: true,
        minutes: true,
        goals: true,
        assists: true,
        yellowCards: true,
        redCards: true,
        ownGoals: true,
        cleanSheet: true,
      },
    });

    const statsByPlayer = new Map<string, PlayerStat>(
      stats.map((stat) => [stat.playerId, stat]),
    );

    const playersByClub = new Map(
      clubIds.map((clubId) => [
        clubId,
        players.filter((player) => player.clubId === clubId),
      ]),
    );

    const toPlayerPayload = (player: (typeof players)[number]) => {
      const stat = statsByPlayer.get(player.id);
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        clubLabel: player.club?.shortName ?? player.club?.slug ?? "",
        minutes: stat?.minutes ?? 0,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        yellowCards: stat?.yellowCards ?? 0,
        redCards: stat?.redCards ?? 0,
        ownGoals: stat?.ownGoals ?? 0,
        cleanSheet: stat?.cleanSheet ?? false,
      };
    };

    return NextResponse.json({
      matchWeek,
      matches: matches.map((match) => ({
        id: match.id,
        kickoffAt: match.kickoffAt,
        status: match.status,
        homeClub: match.homeClub,
        awayClub: match.awayClub,
        homePlayers: (playersByClub.get(match.homeClub.id) ?? []).map(
          toPlayerPayload,
        ),
        awayPlayers: (playersByClub.get(match.awayClub.id) ?? []).map(
          toPlayerPayload,
        ),
      })),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/matchweeks/matches error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
