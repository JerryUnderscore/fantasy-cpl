import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";
import { DraftMode, JoinMode, StandingsMode } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

type ParseResult<T> =
  | { hasValue: false }
  | { hasValue: true; value: T | null };

const getProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
};

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

const parseBooleanField = (value: unknown): ParseResult<boolean> => {
  if (value === undefined) return { hasValue: false };
  if (value === true || value === false) {
    return { hasValue: true, value };
  }
  if (value === "true") return { hasValue: true, value: true };
  if (value === "false") return { hasValue: true, value: false };
  return { hasValue: true, value: null };
};

const getDraftStarted = async (leagueId: string) => {
  const draft = await prisma.draft.findFirst({
    where: { leagueId },
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) return false;
  if (draft.status !== "NOT_STARTED") return true;
  const pick = await prisma.draftPick.findFirst({
    where: { draftId: draft.id },
    select: { id: true },
  });
  return Boolean(pick);
};

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        joinMode: true,
        maxTeams: true,
        standingsMode: true,
        draftMode: true,
        draftPickSeconds: true,
        rosterSize: true,
        keepersEnabled: true,
        keeperCount: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const draftStarted = await getDraftStarted(leagueId);

    return NextResponse.json({
      settings: {
        joinMode: league.joinMode,
        maxTeams: league.maxTeams,
        standingsMode: league.standingsMode,
        draftMode: league.draftMode,
        draftPickSeconds: league.draftPickSeconds,
        rosterSize: league.rosterSize,
        keepersEnabled: league.keepersEnabled,
        keeperCount: league.keeperCount,
      },
      locked: draftStarted,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/leagues/[leagueId]/settings error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { leagueId } = await ctx.params;

    const user = await requireSupabaseUser();
    const profile = await getProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_profileId: { leagueId, profileId: profile.id },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        joinMode: true,
        maxTeams: true,
        standingsMode: true,
        draftMode: true,
        draftPickSeconds: true,
        rosterSize: true,
        keepersEnabled: true,
        keeperCount: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updates: {
      joinMode?: JoinMode;
      maxTeams?: number;
      standingsMode?: StandingsMode;
      draftMode?: DraftMode;
      draftPickSeconds?: number | null;
      rosterSize?: number;
      keepersEnabled?: boolean;
      keeperCount?: number | null;
    } = {};

    const joinMode = parseEnumField(body.joinMode, ["OPEN", "INVITE_ONLY"]);
    if (joinMode.hasValue) {
      if (!joinMode.value) {
        return NextResponse.json({ error: "Invalid join mode" }, { status: 400 });
      }
      updates.joinMode = joinMode.value as JoinMode;
    }

    const maxTeams = parseRequiredInt(body.maxTeams);
    if (maxTeams.hasValue) {
      if (maxTeams.value === null) {
        return NextResponse.json({ error: "Invalid max teams" }, { status: 400 });
      }
      if (maxTeams.value < 2 || maxTeams.value > 20) {
        return NextResponse.json(
          { error: "Max teams must be between 2 and 20" },
          { status: 400 },
        );
      }
      updates.maxTeams = maxTeams.value;
    }

    const standingsRaw =
      body.standingsMode === "H2H" ? "HEAD_TO_HEAD" : body.standingsMode;
    const standingsMode = parseEnumField(standingsRaw, [
      "TOTAL_POINTS",
      "HEAD_TO_HEAD",
    ]);
    if (standingsMode.hasValue) {
      if (!standingsMode.value) {
        return NextResponse.json(
          { error: "Invalid standings mode" },
          { status: 400 },
        );
      }
      updates.standingsMode = standingsMode.value as StandingsMode;
    }

    const draftMode = parseEnumField(body.draftMode, ["ASYNC", "TIMED"]);
    if (draftMode.hasValue) {
      if (!draftMode.value) {
        return NextResponse.json(
          { error: "Invalid draft mode" },
          { status: 400 },
        );
      }
      updates.draftMode = draftMode.value as DraftMode;
    }

    const draftPickSeconds = parseNullableInt(body.draftPickSeconds);
    if (draftPickSeconds.hasValue) {
      if (draftPickSeconds.value === null && body.draftPickSeconds !== null) {
        return NextResponse.json(
          { error: "Invalid draft pick seconds" },
          { status: 400 },
        );
      }
      if (typeof draftPickSeconds.value === "number") {
        if (draftPickSeconds.value < 10 || draftPickSeconds.value > 600) {
          return NextResponse.json(
            { error: "Draft pick seconds must be between 10 and 600" },
            { status: 400 },
          );
        }
      }
      updates.draftPickSeconds = draftPickSeconds.value;
    }

    const rosterSize = parseRequiredInt(body.rosterSize);
    if (rosterSize.hasValue) {
      if (rosterSize.value === null) {
        return NextResponse.json({ error: "Invalid roster size" }, { status: 400 });
      }
      if (rosterSize.value < 1 || rosterSize.value > 30) {
        return NextResponse.json(
          { error: "Roster size must be between 1 and 30" },
          { status: 400 },
        );
      }
      updates.rosterSize = rosterSize.value;
    }

    const keepersEnabled = parseBooleanField(body.keepersEnabled);
    if (keepersEnabled.hasValue) {
      if (keepersEnabled.value === null) {
        return NextResponse.json(
          { error: "Invalid keepersEnabled flag" },
          { status: 400 },
        );
      }
      updates.keepersEnabled = keepersEnabled.value;
    }

    const keeperCount = parseNullableInt(body.keeperCount);
    if (keeperCount.hasValue) {
      if (keeperCount.value === null && body.keeperCount !== null) {
        return NextResponse.json(
          { error: "Invalid keeper count" },
          { status: 400 },
        );
      }
      if (typeof keeperCount.value === "number" && keeperCount.value < 0) {
        return NextResponse.json(
          { error: "Keeper count must be 0 or higher" },
          { status: 400 },
        );
      }
      updates.keeperCount = keeperCount.value;
    }

    const draftStarted = await getDraftStarted(leagueId);
    const lockedFields = new Set([
      "standingsMode",
      "draftMode",
      "draftPickSeconds",
      "maxTeams",
      "joinMode",
      "rosterSize",
    ]);
    const hasLockedChange = Object.keys(updates).some((key) =>
      lockedFields.has(key),
    );

    if (draftStarted && hasLockedChange) {
      return NextResponse.json(
        { error: "Settings are locked once the draft has started" },
        { status: 409 },
      );
    }

    if (updates.maxTeams !== undefined) {
      const teamCount = await prisma.fantasyTeam.count({
        where: { leagueId },
      });
      if (teamCount > updates.maxTeams) {
        return NextResponse.json(
          { error: "Max teams cannot be lower than current team count" },
          { status: 409 },
        );
      }
    }

    if (updates.rosterSize !== undefined) {
      const teamCount = await prisma.fantasyTeam.count({
        where: { leagueId },
      });
      if (teamCount > 0 && updates.rosterSize < league.rosterSize) {
        return NextResponse.json(
          { error: "Roster size cannot be decreased once teams exist" },
          { status: 409 },
        );
      }
    }

    const nextDraftMode = updates.draftMode ?? league.draftMode;
    const nextDraftPickSeconds =
      updates.draftPickSeconds ?? league.draftPickSeconds;
    if (nextDraftMode === "TIMED") {
      if (
        typeof nextDraftPickSeconds !== "number" ||
        !Number.isInteger(nextDraftPickSeconds)
      ) {
        return NextResponse.json(
          { error: "Draft pick seconds required for timed drafts" },
          { status: 400 },
        );
      }
    }

    const nextKeepersEnabled =
      updates.keepersEnabled ?? league.keepersEnabled;
    const nextKeeperCount = updates.keeperCount ?? league.keeperCount;
    if (nextKeepersEnabled) {
      if (
        typeof nextKeeperCount !== "number" ||
        !Number.isInteger(nextKeeperCount) ||
        nextKeeperCount < 1
      ) {
        return NextResponse.json(
          { error: "Keeper count required when keepers are enabled" },
          { status: 400 },
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
    }

    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: updates,
      select: {
        joinMode: true,
        maxTeams: true,
        standingsMode: true,
        draftMode: true,
        draftPickSeconds: true,
        rosterSize: true,
        keepersEnabled: true,
        keeperCount: true,
      },
    });

    return NextResponse.json({ settings: updated });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/leagues/[leagueId]/settings error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
