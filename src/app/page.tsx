import AuthButtons from "@/components/auth-buttons";
import ProfileSync from "@/components/profile-sync";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const provider =
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? null;
  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-black">
            Supabase + Discord auth
          </h1>
          <p className="text-sm text-zinc-500">
            Sign in to view your Supabase user details.
          </p>
        </div>
        {user ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-700">
            <p>
              <span className="font-semibold text-black">User ID:</span>{" "}
              {user.id}
            </p>
            <p>
              <span className="font-semibold text-black">Provider:</span>{" "}
              {provider ?? "unknown"}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-500">
            You are not signed in yet.
          </div>
        )}
        {user && profile ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-700">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Profile
            </p>
            <div className="mt-3 flex items-center gap-4">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName ?? "Profile avatar"}
                  className="h-12 w-12 rounded-full border border-zinc-200 object-cover"
                />
              ) : null}
              <div className="flex flex-col gap-1">
                <p>
                  <span className="font-semibold text-black">Display:</span>{" "}
                  {profile.displayName ?? "—"}
                </p>
                <p>
                  <span className="font-semibold text-black">Discord ID:</span>{" "}
                  {profile.discordId ?? "—"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <AuthButtons isAuthenticated={Boolean(user)} />
        <ProfileSync isAuthenticated={Boolean(user)} />
      </main>
    </div>
  );
}
