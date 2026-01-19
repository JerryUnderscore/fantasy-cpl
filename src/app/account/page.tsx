import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        You need to sign in to view account settings.
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { displayName: true, discordId: true, avatarUrl: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Account
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Account settings
        </h1>
        <p className="text-sm text-zinc-500">
          Manage your profile details and authentication.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.displayName ?? "Profile avatar"}
              className="h-14 w-14 rounded-full border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
              {(profile?.displayName ?? user.email ?? "A")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {profile?.displayName ?? user.email ?? "Unnamed account"}
            </p>
            <p className="text-xs text-zinc-500">
              Discord ID: {profile?.discordId ?? "-"}
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/leagues"
        className="text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
      >
        Back to leagues
      </Link>
    </div>
  );
}
