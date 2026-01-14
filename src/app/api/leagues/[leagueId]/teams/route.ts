import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { leagueId: string };

const getProfileId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  return profile?.id ?? null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { leagueId } = await params;

    const user = await requireSupabaseUser();
    const profileId = await getProfileId(user.id);

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      include: {
        profile: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        profileId: team.profileId,
        displayName: team.profile.displayName,
      })),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/teams error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}