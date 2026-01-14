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

const buildRosterSlots = (fantasyTeamId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    slotIndex: index + 1,
  }));

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
    const name = normalizeName(body?.name);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const profile = await getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 400 });
    }

    for (let attempt = 0; attempt < MAX_INVITE_ATTEMPTS; attempt += 1) {
      const inviteCode = buildInviteCode();

      try {
        const league = await prisma.$transaction(async (tx) => {
          const created = await tx.league.create({
            data: {
              name,
              inviteCode,
              createdById: profile.id, // ✅ FIX: use profile.id
              seasonId: season.id,
            },
            select: { id: true, inviteCode: true },
          });

          await tx.leagueMember.create({
            data: {
              leagueId: created.id,
              profileId: profile.id,
              role: "OWNER",
            },
          });

          const team = await tx.fantasyTeam.upsert({
            where: {
              leagueId_profileId: {
                leagueId: created.id,
                profileId: profile.id,
              },
            },
            update: {},
            create: {
              leagueId: created.id,
              profileId: profile.id,
              name: buildDefaultTeamName(profile),
            },
            select: { id: true },
          });

          await tx.rosterSlot.createMany({
            data: buildRosterSlots(team.id),
            skipDuplicates: true,
          });

          return created;
        });

        return NextResponse.json({
          leagueId: league.id,
          inviteCode: league.inviteCode,
        });
      } catch (error) {
        // Unique constraint collision on inviteCode => try again
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

    const profile = await getProfile(user.id); // ✅ FIX: no getProfileId
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.leagueMember.findMany({
      where: { profileId: profile.id },
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
