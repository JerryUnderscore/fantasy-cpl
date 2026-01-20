import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { normalizeLeagueWaiverTimes } from "@/lib/waivers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type PlayerAvailabilityStatus = "FREE_AGENT" | "WAIVERS" | "ROSTERED";

type AvailablePlayer = {
  id: string;
  name: string;
  position: string;
  club: { slug: string; shortName: string | null; name: string } | null;
  status: PlayerAvailabilityStatus;
  waiverAvailableAt?: string;
  rosteredByFantasyTeamId?: string;
  rosteredByTeamName?: string;
};

type AvailablePlayersResponse = {
  leagueId: string;
  now: string;
  counts: Record<PlayerAvailabilityStatus, number>;
  players: AvailablePlayer[];
};

const statusOrder: Record<PlayerAvailabilityStatus, number> = {
  FREE_AGENT: 0,
  WAIVERS: 1,
  ROSTERED: 2,
};

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

export async function GET(_request: NextRequest, ctx: Ctx) {
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

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, seasonId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const now = new Date();

    await normalizeLeagueWaiverTimes(prisma, leagueId, new Date());

    const [players, rosterSlots, waivers] = await Promise.all([
      prisma.player.findMany({
        where: { seasonId: league.seasonId, active: true },
        select: {
          id: true,
          name: true,
          position: true,
          club: { select: { slug: true, shortName: true, name: true } },
        },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      }),
      prisma.rosterSlot.findMany({
        where: {
          leagueId,
          playerId: { not: null },
          player: { active: true },
        },
        select: {
          playerId: true,
          fantasyTeam: { select: { id: true, name: true } },
        },
      }),
      prisma.leaguePlayerWaiver.findMany({
        where: { leagueId },
        select: { playerId: true, waiverAvailableAt: true },
      }),
    ]);

    const seenPlayers = new Set<string>();
    const uniquePlayers = players.filter((player) => {
      if (seenPlayers.has(player.id)) return false;
      seenPlayers.add(player.id);
      return true;
    });

    const rosteredMap = new Map<
      string,
      { fantasyTeamId: string; fantasyTeamName: string }
    >();
    for (const slot of rosterSlots) {
      if (!slot.playerId) continue;
      rosteredMap.set(slot.playerId, {
        fantasyTeamId: slot.fantasyTeam.id,
        fantasyTeamName: slot.fantasyTeam.name,
      });
    }

    const waiverMap = new Map<string, Date>();
    for (const waiver of waivers) {
      waiverMap.set(waiver.playerId, waiver.waiverAvailableAt);
    }

    const counts: AvailablePlayersResponse["counts"] = {
      FREE_AGENT: 0,
      WAIVERS: 0,
      ROSTERED: 0,
    };

    const resultPlayers: AvailablePlayer[] = uniquePlayers.map((player) => {
      const rostered = rosteredMap.get(player.id);
      if (rostered) {
        counts.ROSTERED += 1;
        return {
          id: player.id,
          name: player.name,
          position: player.position,
          club: player.club,
          status: "ROSTERED",
          rosteredByFantasyTeamId: rostered.fantasyTeamId,
          rosteredByTeamName: rostered.fantasyTeamName,
        };
      }

      const waiverAvailableAt = waiverMap.get(player.id);
      if (waiverAvailableAt && waiverAvailableAt > now) {
        counts.WAIVERS += 1;
        return {
          id: player.id,
          name: player.name,
          position: player.position,
          club: player.club,
          status: "WAIVERS",
          waiverAvailableAt: waiverAvailableAt.toISOString(),
        };
      }

      counts.FREE_AGENT += 1;
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        club: player.club,
        status: "FREE_AGENT",
        waiverAvailableAt: waiverAvailableAt
          ? waiverAvailableAt.toISOString()
          : undefined,
      };
    });

    resultPlayers.sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (a.position !== b.position) {
        return a.position.localeCompare(b.position);
      }
      return a.name.localeCompare(b.name);
    });

    const response: AvailablePlayersResponse = {
      leagueId,
      now: now.toISOString(),
      counts,
      players: resultPlayers,
    };

    return NextResponse.json(response);
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(
      "GET /api/leagues/[leagueId]/players/available error",
      error,
    );
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
