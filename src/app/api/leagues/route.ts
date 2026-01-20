import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import {
  DraftMode,
  JoinMode,
  PlayerPosition,
  StandingsMode,
} from "@prisma/client";

export const runtime = "nodejs";

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 8;
const MAX_INVITE_ATTEMPTS = 6;

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type ParseResult<T> =
  | { hasValue: false }
  | { hasValue: true; value: T | null };

const parseEnumField = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): ParseResult<T> => {
  if (value === undefined) return { hasValue: false };
  if (allowed.includes(value as T)) {
    return { hasValue: true, value: value as T };
  }
  return { hasValue: true, value: null };
};

const parseNullableInt = (value: unknown): ParseResult<number> => {
  if (value === undefined) return { hasValue: false };
  if (value === null || value === "") return { hasValue: true, value: null };
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { hasValue: true, value: null };
  }
  return { hasValue: true, value: parsed };
};

const parseDateTime = (value: unknown): ParseResult<Date> => {
  if (value === undefined) return { hasValue: false };
  if (value === null || value === "") return { hasValue: true, value: null };
  if (typeof value !== "string") return { hasValue: true, value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { hasValue: true, value: null };
  }
  return { hasValue: true, value: parsed };
};

const parseRequiredInt = (value: unknown): ParseResult<number> => {
  if (value === undefined) return { hasValue: false };
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { hasValue: true, value: null };
  }
  return { hasValue: true, value: parsed };
};

const buildInviteCode = () => {
  let result = "";
  for (let i = 0; i < INVITE_LENGTH; i += 1) {
    const index = randomInt(0, INVITE_ALPHABET.length);
    result += INVITE_ALPHABET[index];
  }
  return result;
};

const buildRosterSlots = (fantasyTeamId: string, leagueId: string) =>
  Array.from({ length: 15 }, (_, index) => ({
    fantasyTeamId,
    leagueId,
    slotNumber: index + 1,
    position: PlayerPosition.MID,
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

    const joinMode = parseEnumField(body?.joinMode, ["OPEN", "INVITE_ONLY"]);
    if (joinMode.hasValue && !joinMode.value) {
      return NextResponse.json({ error: "Invalid join mode" }, { status: 400 });
    }

    const maxTeams = parseRequiredInt(body?.maxTeams);
    if (maxTeams.hasValue) {
      if (maxTeams.value === null) {
        return NextResponse.json(
          { error: "Invalid max teams" },
          { status: 400 },
        );
      }
      if (maxTeams.value < 2 || maxTeams.value > 20) {
        return NextResponse.json(
          { error: "Max teams must be between 2 and 20" },
          { status: 400 },
        );
      }
    }

    const standingsRaw =
      body?.standingsMode === "H2H" ? "HEAD_TO_HEAD" : body?.standingsMode;
    const standingsMode = parseEnumField(standingsRaw, [
      "TOTAL_POINTS",
      "HEAD_TO_HEAD",
    ]);
    if (standingsMode.hasValue && !standingsMode.value) {
      return NextResponse.json(
        { error: "Invalid standings mode" },
        { status: 400 },
      );
    }

    const draftMode = parseEnumField(body?.draftMode, [
      "LIVE",
      "CASUAL",
      "NONE",
    ]);
    if (draftMode.hasValue && !draftMode.value) {
      return NextResponse.json(
        { error: "Invalid draft mode" },
        { status: 400 },
      );
    }

    const draftPickSeconds = parseNullableInt(body?.draftPickSeconds);
    const draftScheduledAt = parseDateTime(body?.draftScheduledAt);
    let draftPickSecondsValue: number | null | undefined = undefined;
    let draftScheduledAtValue: Date | null | undefined = undefined;
    if (draftMode.hasValue) {
      if (draftMode.value === "LIVE") {
        if (!draftPickSeconds.hasValue || draftPickSeconds.value === null) {
          return NextResponse.json(
            { error: "Draft pick seconds required for live draft" },
            { status: 400 },
          );
        }
        if (draftPickSeconds.value < 10 || draftPickSeconds.value > 600) {
          return NextResponse.json(
            { error: "Draft pick seconds must be between 10 and 600" },
            { status: 400 },
          );
        }
        draftPickSecondsValue = draftPickSeconds.value;
        if (!draftScheduledAt.hasValue || !draftScheduledAt.value) {
          return NextResponse.json(
            { error: "Draft schedule required for live draft" },
            { status: 400 },
          );
        }
        draftScheduledAtValue = draftScheduledAt.value;
      } else {
        draftPickSecondsValue = null;
        draftScheduledAtValue = null;
      }
    } else if (draftPickSeconds.hasValue) {
      return NextResponse.json(
        { error: "Draft mode is required when setting draft pick seconds" },
        { status: 400 },
      );
    }
    if (draftMode.hasValue && draftMode.value !== "LIVE") {
      if (draftScheduledAt.hasValue && draftScheduledAt.value !== null) {
        return NextResponse.json(
          { error: "Draft schedule is only for live drafts" },
          { status: 400 },
        );
      }
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
              teamCount: 1,
              ...(joinMode.hasValue
                ? { joinMode: joinMode.value as JoinMode }
                : {}),
              ...(maxTeams.hasValue ? { maxTeams: maxTeams.value } : {}),
              ...(standingsMode.hasValue
                ? { standingsMode: standingsMode.value as StandingsMode }
                : {}),
              ...(draftMode.hasValue
                ? { draftMode: draftMode.value as DraftMode }
                : {}),
              ...(draftPickSecondsValue !== undefined
                ? { draftPickSeconds: draftPickSecondsValue }
                : {}),
              ...(draftScheduledAtValue !== undefined
                ? { draftScheduledAt: draftScheduledAtValue }
                : {}),
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
            data: buildRosterSlots(team.id, created.id),
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
