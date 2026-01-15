import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.$queryRaw<
    { column_name: string; data_type: string; is_nullable: string }[]
  >`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name='RosterSlot'
    order by ordinal_position;
  `;

  return NextResponse.json({
    ok: true,
    columns: rows,
  });
}