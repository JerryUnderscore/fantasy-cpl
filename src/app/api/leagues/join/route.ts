import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

const normalizeInviteCode = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
};

const getProfileId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  return profile?.id ?? null;
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

    const profileId = await getProfileId(user.id);
    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const league = await prisma.league.findUnique({
      where: { inviteCode },
    });

    if (!league) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    await prisma.leagueMember.upsert({
      where: {
        leagueId_profileId: {
          leagueId: league.id,
          profileId,
        },
      },
      update: {},
      create: {
        leagueId: league.id,
        profileId,
        role: "MEMBER",
      },
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
