"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthButtonsProps = {
  isAuthenticated: boolean;
};

export default function AuthButtons({ isAuthenticated }: AuthButtonsProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-black transition hover:bg-black/5"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-black/80"
    >
      Sign in with Discord
    </button>
  );
}
