import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { PlayerPosition } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const MAX_TEAMS_PER_LEAGUE = 12;

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, discordId: true },
  });
};

const buildDefaultTeamName = (profile: {
  id: string;
  displayName: string | null;
  discordId: string | null;
}) => {
  if (profile.displayName?.trim()) return profile.displayName.trim();
  const suffixSource = profile.discordId ?? profile.id;
  return `Team ${suffixSource.slice(0, 6)}`;
};

const buildRosterSlots = (fantasyTeamId: string, leagueId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

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

    const existing = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      const count = await prisma.fantasyTeam.count({ where: { leagueId } });
      if (count >= MAX_TEAMS_PER_LEAGUE) {
        return NextResponse.json({ error: "League is full" }, { status: 409 });
      }
    }

    const body = await request.json().catch(() => null);
    const requestedName = normalizeName(body?.name);

    const team = await prisma.fantasyTeam.upsert({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      update: {
        name: requestedName ?? undefined,
      },
      create: {
        leagueId,
        profileId: profile.id,
        name: requestedName ?? buildDefaultTeamName(profile),
      },
      select: { id: true, name: true },
    });

    await prisma.rosterSlot.createMany({
      data: buildRosterSlots(team.id, leagueId),
      skipDuplicates: true,
    });

    return NextResponse.json({ team });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/team error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
