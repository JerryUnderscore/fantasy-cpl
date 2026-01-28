import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AccountSettingsClient from "@/app/account/account-settings-client";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SectionCard
        title="Account"
        description="You need to sign in to view account settings."
      >
        <p className="text-sm text-[var(--text-muted)]">Authentication required.</p>
      </SectionCard>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { displayName: true, discordId: true, avatarUrl: true },
  });

  const identities = user.identities ?? [];
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata?.providers
    : [];
  const hasEmailProvider =
    identities.some((identity) => identity.provider === "email") ||
    providers.includes("email");
  const hasDiscordProvider =
    identities.some((identity) => identity.provider === "discord") ||
    providers.includes("discord") ||
    Boolean(profile?.discordId);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account settings"
        subtitle="Manage your profile details and authentication."
      />

      <AccountSettingsClient
        email={user.email ?? ""}
        displayName={profile?.displayName ?? ""}
        avatarUrl={profile?.avatarUrl ?? null}
        discordId={profile?.discordId ?? null}
        hasEmailProvider={hasEmailProvider}
        hasDiscordProvider={hasDiscordProvider}
        createdAt={user.created_at ?? null}
        lastSignInAt={user.last_sign_in_at ?? null}
        appVersion={appVersion}
      />

      <Link
        href="/leagues"
        className="text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
      >
        Back to leagues
      </Link>
    </div>
  );
}
