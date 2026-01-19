import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireSupabaseUser();
  const body = (await request.json()) as { displayName?: string };
  const displayName = body.displayName?.trim() ?? "";

  if (displayName.length > 40) {
    return NextResponse.json(
      { error: "Display name must be 40 characters or fewer." },
      { status: 400 },
    );
  }

  const normalizedDisplayName = displayName.length ? displayName : null;

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, displayName: normalizedDisplayName },
    update: { displayName: normalizedDisplayName },
    select: { displayName: true },
  });

  return NextResponse.json(profile);
}
