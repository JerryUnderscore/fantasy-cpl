import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string; teamId: string }> };

const getProfile = async (userId: string) =>
  prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });

export async function GET(_: NextRequest, ctx: Ctx) {
  try {
    const { leagueId, teamId } = await ctx.params;

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

    const team = await prisma.fantasyTeam.findFirst({
      where: { id: teamId, leagueId },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const rosterSlots = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: team.id, playerId: { not: null } },
      orderBy: { slotNumber: "asc" },
      select: {
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

    const seenPlayers = new Set<string>();
    const players = rosterSlots
      .map((slot) => slot.player)
      .filter((player): player is NonNullable<typeof player> => {
        if (!player) return false;
        if (seenPlayers.has(player.id)) return false;
        seenPlayers.add(player.id);
        return true;
      });

    return NextResponse.json({ team, players });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/teams/[teamId]/roster error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
