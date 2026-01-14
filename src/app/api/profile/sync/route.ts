import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const pickString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const discordIdentity = user.identities?.[0];
  const identityData = discordIdentity?.identity_data ?? {};
  const customClaims =
    typeof identityData.custom_claims === "object" &&
    identityData.custom_claims !== null
      ? identityData.custom_claims
      : {};

  const discordId = pickString(
    discordIdentity?.id ?? identityData.provider_id ?? identityData.sub,
  );
  const displayName = pickString(
    customClaims.global_name ?? identityData.full_name ?? identityData.name,
  );
  const avatarUrl = pickString(
    identityData.avatar_url ?? identityData.picture,
  );

  const createData = {
    id: user.id,
    ...(discordId ? { discordId } : {}),
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
  const updateData = {
    ...(discordId ? { discordId } : {}),
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    create: createData,
    update: updateData,
  });

  return NextResponse.json({ profile });
}
