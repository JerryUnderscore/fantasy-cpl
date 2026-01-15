import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      { column_name: string; is_nullable: "YES" | "NO"; column_default: string | null }[]
    >`
      select column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema='public' and table_name='RosterSlot'
      order by ordinal_position;
    `;

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    console.error("roster-slot-meta error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}