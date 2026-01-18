import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { PlayerPosition } from "@prisma/client";

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

const buildRosterSlots = (fantasyTeamId: string, leagueId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
  }));

export async function POST(request: Request) {
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

    const league = inviteCode
      ? await prisma.league.findUnique({
          where: { inviteCode },
          select: { id: true, inviteCode: true, joinMode: true, maxTeams: true },
        })
      : await prisma.league.findUnique({
          where: { id: leagueId ?? undefined },
          select: { id: true, inviteCode: true, joinMode: true, maxTeams: true },
        });

    if (!league) {
      return NextResponse.json(
        { error: inviteCode ? "Invalid invite code" : "League not found" },
        { status: 404 },
      );
    }

    if (league.joinMode === "INVITE_ONLY" && !inviteCode) {
      return NextResponse.json(
        { error: "Invite code required to join this league" },
        { status: 403 },
      );
    }

    const existingTeam = await prisma.fantasyTeam.findUnique({
      where: {
        leagueId_profileId: { leagueId: league.id, profileId: profile.id },
      },
      select: { id: true },
    });

    if (!existingTeam) {
      const count = await prisma.fantasyTeam.count({
        where: { leagueId: league.id },
      });
      if (count >= league.maxTeams) {
        return NextResponse.json({ error: "League is full" }, { status: 409 });
      }
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

      const team = await tx.fantasyTeam.upsert({
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
        select: { id: true },
      });

      await tx.rosterSlot.createMany({
        data: buildRosterSlots(team.id, league.id),
        skipDuplicates: true,
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
