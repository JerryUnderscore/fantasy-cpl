import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { Prisma, PlayerPosition } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

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

class LeagueFullError extends Error {
  constructor() {
    super("League is full");
    this.name = "LeagueFullError";
  }
}

const reserveTeamSlot = async (
  tx: Prisma.TransactionClient,
  leagueId: string,
  maxTeams: number,
) => {
  const updated = await tx.league.updateMany({
    where: { id: leagueId, teamCount: { lt: maxTeams } },
    data: { teamCount: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new LeagueFullError();
  }
};

export async function POST(request: NextRequest, ctx: Ctx) {
  let resolvedProfileId: string | null = null;

  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    resolvedProfileId = profile.id;

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
      select: { id: true, maxTeams: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const requestedName = normalizeName(body?.name);
    const team = await prisma.$transaction(async (tx) => {
      const existing = await tx.fantasyTeam.findUnique({
        where: {
          leagueId_profileId: {
            leagueId,
            profileId: profile.id,
          },
        },
        select: { id: true, name: true },
      });

      if (existing) {
        const updated = await tx.fantasyTeam.update({
          where: { id: existing.id },
          data: { name: requestedName ?? undefined },
          select: { id: true, name: true },
        });
        return updated;
      }

      await reserveTeamSlot(tx, leagueId, league.maxTeams);

      const created = await tx.fantasyTeam.create({
        data: {
          leagueId,
          profileId: profile.id,
          name: requestedName ?? buildDefaultTeamName(profile),
        },
        select: { id: true, name: true },
      });

      await tx.rosterSlot.createMany({
        data: buildRosterSlots(created.id, leagueId),
        skipDuplicates: true,
      });

      return created;
    });

    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof LeagueFullError) {
      return NextResponse.json({ error: "League is full" }, { status: 409 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      resolvedProfileId
    ) {
      const { leagueId } = await ctx.params;
      const existing = await prisma.fantasyTeam.findUnique({
        where: {
          leagueId_profileId: {
            leagueId,
            profileId: resolvedProfileId,
          },
        },
        select: { id: true, name: true },
      });
      if (existing) {
        return NextResponse.json({ team: existing });
      }
    }
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/[leagueId]/team error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
