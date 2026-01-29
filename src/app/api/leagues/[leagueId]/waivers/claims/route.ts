import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

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

    const pendingClaims = await prisma.leagueWaiverClaim.findMany({
      where: { leagueId, fantasyTeamId: team.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        priorityNumberAtSubmit: true,
        playerId: true,
        player: {
          select: { id: true, name: true, jerseyNumber: true, position: true },
        },
        dropPlayer: {
          select: { id: true, name: true, jerseyNumber: true, position: true },
        },
      },
    });

    const waivers = await prisma.leaguePlayerWaiver.findMany({
      where: {
        leagueId,
        playerId: { in: pendingClaims.map((claim) => claim.playerId) },
      },
      select: { playerId: true, waiverAvailableAt: true },
    });

    const waiverMap = new Map(
      waivers.map((waiver) => [waiver.playerId, waiver.waiverAvailableAt]),
    );

    const resolvedClaims = await prisma.leagueWaiverClaim.findMany({
      where: {
        leagueId,
        fantasyTeamId: team.id,
        status: { in: ["WON", "LOST"] },
      },
      orderBy: { processedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        processedAt: true,
        player: {
          select: { id: true, name: true, jerseyNumber: true, position: true },
        },
      },
    });

    return NextResponse.json({
      pendingClaims: pendingClaims.map((claim) => ({
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
        priorityNumberAtSubmit: claim.priorityNumberAtSubmit,
        player: claim.player,
        dropPlayer: claim.dropPlayer,
        waiverAvailableAt: waiverMap.get(claim.playerId)?.toISOString() ?? null,
      })),
      resolvedClaims,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/waivers/claims error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
