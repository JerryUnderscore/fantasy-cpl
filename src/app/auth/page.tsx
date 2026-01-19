import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";

export const runtime = "nodejs";

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-black">Sign in</h1>
        <p className="text-sm text-zinc-500">
          Use Discord or email to access your leagues.
        </p>
      </div>
      <AuthButtons isAuthenticated={false} />
      <Link
        href="/"
        className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
