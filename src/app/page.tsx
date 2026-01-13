import AuthButtons from "@/components/auth-buttons";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const provider =
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? null;

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
        <AuthButtons isAuthenticated={Boolean(user)} />
      </main>
    </div>
  );
}
