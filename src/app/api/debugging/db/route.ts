import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      { current_database: string; current_schema: string }[]
    >`select current_database() as current_database, current_schema() as current_schema;`;

    const db = rows?.[0] ?? null;

    const dbUrlHost = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).host
      : null;

    return NextResponse.json({
      ok: true,
      db,
      // Helps sanity-check env loading without leaking secrets:
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbUrlHost,
      nodeEnv: process.env.NODE_ENV ?? null,
    });
  } catch (err) {
    console.error("debug db route error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}