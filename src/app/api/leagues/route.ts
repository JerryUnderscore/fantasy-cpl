import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 8;
const MAX_INVITE_ATTEMPTS = 6;

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildInviteCode = () => {
  let result = "";
  for (let i = 0; i < INVITE_LENGTH; i += 1) {
    const index = randomInt(0, INVITE_ALPHABET.length);
    result += INVITE_ALPHABET[index];
  }
  return result;
};

const getProfileId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  return profile?.id ?? null;
};

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser();
    const body = await request.json().catch(() => null);
    const name = normalizeName(body?.name);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const profileId = await getProfileId(user.id);
    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
    });

    if (!season) {
      return NextResponse.json(
        { error: "No active season" },
        { status: 400 },
      );
    }

    for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
      const inviteCode = buildInviteCode();

      try {
        const league = await prisma.$transaction(async (tx) => {
          const created = await tx.league.create({
            data: {
              name,
              inviteCode,
              createdById: profileId,
              seasonId: season.id,
            },
          });

          await tx.leagueMember.create({
            data: {
              leagueId: created.id,
              profileId,
              role: "OWNER",
            },
          });

          return created;
        });

        return NextResponse.json({
          leagueId: league.id,
          inviteCode: league.inviteCode,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json(
      { error: "Failed to generate invite code" },
      { status: 500 },
    );
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireSupabaseUser();
    const profileId = await getProfileId(user.id);

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.leagueMember.findMany({
      where: { profileId },
      include: {
        league: {
          include: {
            season: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const leagues = memberships.map((membership) => ({
      id: membership.league.id,
      name: membership.league.name,
      season: {
        id: membership.league.season.id,
        year: membership.league.season.year,
        name: membership.league.season.name,
      },
      role: membership.role,
      inviteCode:
        membership.role === "OWNER" ? membership.league.inviteCode : undefined,
    }));

    return NextResponse.json({ leagues });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
