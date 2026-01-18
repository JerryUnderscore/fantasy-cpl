import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { processLeagueWaivers } from "@/lib/waivers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leagueId: string }> };

const parseNow = (value: unknown) => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdminUser();

    const { leagueId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const nowOverride = parseNow(body?.now);
    if (body?.now && !nowOverride) {
      return NextResponse.json(
        { error: "Invalid now timestamp" },
        { status: 400 },
      );
    }
    const now = nowOverride ?? new Date();

    const processed = await processLeagueWaivers(leagueId, now);

    if (!processed) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      now: now.toISOString(),
      result: processed.result,
      lockInfo: processed.lockInfo,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(
      "POST /api/admin/leagues/[leagueId]/waivers/process error",
      error,
    );
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
