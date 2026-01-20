import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const teams = await tx.fantasyTeam.findMany({
        where: { leagueId },
        select: { id: true },
      });
      const teamIds = teams.map((team) => team.id);

      if (teamIds.length) {
        await tx.teamMatchWeekPlayerScore.deleteMany({
          where: { fantasyTeamId: { in: teamIds } },
        });
        await tx.teamMatchWeekScore.deleteMany({
          where: { fantasyTeamId: { in: teamIds } },
        });
        await tx.teamMatchWeekLineupSlot.deleteMany({
          where: { fantasyTeamId: { in: teamIds } },
        });
      }

      await tx.leagueMatchup.deleteMany({ where: { leagueId } });
      await tx.leagueTeamRecord.deleteMany({ where: { leagueId } });
      await tx.leagueWaiverClaim.deleteMany({ where: { leagueId } });
      await tx.leagueWaiverPriority.deleteMany({ where: { leagueId } });
      await tx.leaguePlayerWaiver.deleteMany({ where: { leagueId } });
      await tx.rosterSlot.deleteMany({ where: { leagueId } });
      await tx.draftPick.deleteMany({
        where: { draft: { leagueId } },
      });
      await tx.draft.deleteMany({ where: { leagueId } });
      await tx.fantasyTeam.deleteMany({ where: { leagueId } });
      await tx.leagueMember.deleteMany({ where: { leagueId } });
      await tx.league.delete({ where: { id: leagueId } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/leagues/[leagueId] error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
