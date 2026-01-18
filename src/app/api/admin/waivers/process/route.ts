import { NextRequest, NextResponse } from "next/server";
import { processAllLeaguesWaivers } from "@/lib/waivers";

export const runtime = "nodejs";

const parseNow = (value: unknown) => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get("x-cron-secret");

    if (!secret || headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const nowOverride = parseNow(body?.now);
    if (body?.now && !nowOverride) {
      return NextResponse.json(
        { error: "Invalid now timestamp" },
        { status: 400 },
      );
    }
    const now = nowOverride ?? new Date();

    const result = await processAllLeaguesWaivers(now);

    return NextResponse.json({
      ok: true,
      now: now.toISOString(),
      result: {
        leaguesProcessed: result.leaguesProcessed,
        results: result.results.map((entry) => ({
          leagueId: entry.leagueId,
          result: entry.result,
          lockInfo: entry.lockInfo,
        })),
      },
    });
  } catch (error) {
    console.error("POST /api/admin/waivers/process error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
