import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { buildRosterSlots } from "@/lib/roster";

export const runtime = "nodejs";

const normalizeInviteCode = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLeagueId = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
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

export async function POST(request: Request) {
  let resolvedLeagueId: string | null = null;
  let resolvedProfileId: string | null = null;

  try {
    const user = await requireSupabaseUser();
    const body = await request.json().catch(() => null);
    const inviteCode = normalizeInviteCode(body?.inviteCode);
    const leagueId = normalizeLeagueId(body?.leagueId);

    if (!inviteCode && !leagueId) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 },
      );
    }

    const profile = await getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    resolvedProfileId = profile.id;

    const league = inviteCode
      ? await prisma.league.findUnique({
          where: { inviteCode },
          select: {
            id: true,
            inviteCode: true,
            joinMode: true,
            maxTeams: true,
            rosterSize: true,
          },
        })
      : await prisma.league.findUnique({
          where: { id: leagueId ?? undefined },
          select: {
            id: true,
            inviteCode: true,
            joinMode: true,
            maxTeams: true,
            rosterSize: true,
          },
        });

    if (!league) {
      return NextResponse.json(
        { error: inviteCode ? "Invalid invite code" : "League not found" },
        { status: 404 },
      );
    }
    resolvedLeagueId = league.id;

    if (league.joinMode === "INVITE_ONLY" && !inviteCode) {
      return NextResponse.json(
        { error: "Invite code required to join this league" },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const existingTeam = await tx.fantasyTeam.findUnique({
        where: {
          leagueId_profileId: { leagueId: league.id, profileId: profile.id },
        },
        select: { id: true },
      });

      if (!existingTeam) {
        await reserveTeamSlot(tx, league.id, league.maxTeams);
      }

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

      const teamId =
        existingTeam?.id ??
        (
          await tx.fantasyTeam.create({
            data: {
              leagueId: league.id,
              profileId: profile.id,
              name: buildDefaultTeamName(profile),
            },
            select: { id: true },
          })
        ).id;

      await tx.rosterSlot.createMany({
        data: buildRosterSlots(teamId, league.id, league.rosterSize),
        skipDuplicates: true,
      });
    });

    return NextResponse.json({ leagueId: league.id });
  } catch (error) {
    if (error instanceof LeagueFullError) {
      return NextResponse.json({ error: "League is full" }, { status: 409 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      resolvedLeagueId &&
      resolvedProfileId
    ) {
      await prisma.leagueMember.upsert({
        where: {
          leagueId_profileId: {
            leagueId: resolvedLeagueId,
            profileId: resolvedProfileId,
          },
        },
        update: {},
        create: {
          leagueId: resolvedLeagueId,
          profileId: resolvedProfileId,
          role: "MEMBER",
        },
      });
      return NextResponse.json({ leagueId: resolvedLeagueId });
    }
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/leagues/join error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
