"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthButtonsProps = {
  isAuthenticated: boolean;
};

type StatusState = {
  type: "success" | "error";
  message: string;
};

export default function AuthButtons({ isAuthenticated }: AuthButtonsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDiscordSignIn = async () => {
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

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setStatus({ type: "error", message: error.message });
          return;
        }

        if (!data.session) {
          setStatus({
            type: "success",
            message: "Check your email to confirm your account.",
          });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatus({ type: "error", message: error.message });
          return;
        }
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleDiscordSignIn}
        className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-black/80"
      >
        Sign in with Discord
      </button>

      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        Or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={6}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/40"
        >
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {status ? (
        <p
          className={`text-sm ${
            status.type === "error" ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() =>
          setMode((current) => (current === "signup" ? "signin" : "signup"))
        }
        className="text-left text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
      >
        {mode === "signup"
          ? "Already have an account? Sign in."
          : "Need an account? Sign up."}
      </button>
    </div>
  );
}
