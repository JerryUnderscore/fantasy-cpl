import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

const normalizeInviteCode = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
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
  if (profile.displayName?.trim()) {
    return profile.displayName.trim();
  }
  const suffixSource = profile.discordId ?? profile.id;
  return `Team ${suffixSource.slice(0, 6)}`;
};

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser();
    const body = await request.json().catch(() => null);
    const inviteCode = normalizeInviteCode(body?.inviteCode);

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 },
      );
    }

    const profile = await getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const league = await prisma.league.findUnique({
      where: { inviteCode },
    });

    if (!league) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.leagueMember.upsert({
        where: {
          leagueId_profileId: {
            leagueId: league.id,
            profileId: profile.id,
          },
        },
        update: {},
        create: {
          leagueId: league.id,
          profileId: profile.id,
          role: "MEMBER",
        },
      });

      await tx.fantasyTeam.upsert({
        where: {
          leagueId_profileId: {
            leagueId: league.id,
            profileId: profile.id,
          },
        },
        update: {},
        create: {
          leagueId: league.id,
          profileId: profile.id,
          name: buildDefaultTeamName(profile),
        },
      });
    });

    return NextResponse.json({ leagueId: league.id });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/join error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
