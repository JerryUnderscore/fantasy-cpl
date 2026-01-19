"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountSettingsClientProps = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  discordId: string | null;
  hasEmailProvider: boolean;
  hasDiscordProvider: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  appVersion: string;
};

type StatusState = {
  type: "success" | "error";
  message: string;
};

export default function AccountSettingsClient({
  email,
  displayName,
  avatarUrl,
  discordId,
  hasEmailProvider,
  hasDiscordProvider,
  createdAt,
  lastSignInAt,
  appVersion,
}: AccountSettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [nameValue, setNameValue] = useState(displayName);
  const [nameStatus, setNameStatus] = useState<StatusState | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<StatusState | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    [],
  );

  const formatDate = (value: string | null) => {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  };

  const handleDisplayNameSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameStatus(null);
    setIsSavingName(true);

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameValue }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setNameStatus({
          type: "error",
          message: payload?.error ?? "Unable to update display name.",
        });
        return;
      }

      setNameStatus({ type: "success", message: "Display name updated." });
      router.refresh();
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);

    if (passwordValue.length < 6) {
      setPasswordStatus({
        type: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    if (passwordValue !== passwordConfirm) {
      setPasswordStatus({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordValue,
      });

      if (error) {
        setPasswordStatus({ type: "error", message: error.message });
        return;
      }

      setPasswordStatus({
        type: "success",
        message: "Password updated successfully.",
      });
      setPasswordValue("");
      setPasswordConfirm("");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      router.refresh();
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const initials =
    (nameValue || email || "A").slice(0, 2).toUpperCase() || "A";

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Identity & access
          </h2>
          <p className="text-sm text-zinc-500">
            Control how you sign in and manage active sessions.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
              Email address
              <input
                type="email"
                value={email}
                readOnly
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600"
              />
            </label>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Linked accounts
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
                <div className="flex items-center justify-between">
                  <span>Email / Password</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      hasEmailProvider
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {hasEmailProvider ? "Linked" : "Not linked"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discord</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      hasDiscordProvider
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {hasDiscordProvider ? "Linked" : "Not linked"}
                  </span>
                </div>
                {hasDiscordProvider ? (
                  <p className="text-xs text-zinc-500">
                    Discord ID: {discordId ?? "Connected"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">
                Password change
              </p>
              {hasEmailProvider ? (
                <form
                  onSubmit={handlePasswordUpdate}
                  className="mt-3 flex flex-col gap-3"
                >
                  <input
                    type="password"
                    placeholder="New password"
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/40"
                  >
                    Update password
                  </button>
                  {passwordStatus ? (
                    <p
                      className={`text-sm ${
                        passwordStatus.type === "error"
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {passwordStatus.message}
                    </p>
                  ) : null}
                </form>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Managed via Discord. Link an email/password account to change
                  your password here.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">
                Sessions
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li className="flex items-center justify-between">
                  <span>Account created</span>
                  <span className="text-zinc-500">{formatDate(createdAt)}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Last sign-in</span>
                  <span className="text-zinc-500">{formatDate(lastSignInAt)}</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={handleSignOutAll}
                disabled={isSigningOutAll}
                className="mt-4 w-full rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Sign out of all sessions
              </button>
              <p className="mt-2 text-xs text-zinc-400">
                Device details are coming soon.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Profile & display
          </h2>
          <p className="text-sm text-zinc-500">
            Customize how your account appears to other managers.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName || "Profile avatar"}
                className="h-20 w-20 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white">
                {initials}
              </div>
            )}
            <p className="text-sm font-semibold text-zinc-900">
              {nameValue || email || "Unnamed account"}
            </p>
            {hasDiscordProvider ? (
              <p className="text-xs text-zinc-500">
                Avatar synced from Discord
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Uploads coming soon
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <form
              onSubmit={handleDisplayNameSave}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Display name
                <input
                  type="text"
                  value={nameValue}
                  onChange={(event) => setNameValue(event.target.value)}
                  maxLength={40}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={isSavingName}
                className="w-fit rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/40"
              >
                Save display name
              </button>
              {nameStatus ? (
                <p
                  className={`text-sm ${
                    nameStatus.type === "error"
                      ? "text-red-600"
                      : "text-emerald-600"
                  }`}
                >
                  {nameStatus.message}
                </p>
              ) : null}
            </form>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Time zone
                <input
                  type="text"
                  value={timeZone}
                  readOnly
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Preferred language
                <input
                  type="text"
                  value="English (US)"
                  readOnly
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Notifications
          </h2>
          <p className="text-sm text-zinc-500">
            Decide what we send you as the season progresses.
          </p>
        </div>

        <div className="mt-6 grid gap-3 text-sm text-zinc-600">
          {[
            "Email notifications",
            "Draft notifications",
            "League activity notifications",
            "System announcements",
          ].map((label) => (
            <label
              key={label}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                disabled
                className="h-4 w-4 rounded border-zinc-300"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Notification preferences are coming soon.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            League-specific preferences
          </h2>
          <p className="text-sm text-zinc-500">
            Tailor settings for each league you manage.
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          League-specific preferences will appear here once enabled.
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Privacy & safety
          </h2>
          <p className="text-sm text-zinc-500">
            Control your data and account lifecycle.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">
              Data export
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Downloadable exports are coming soon.
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">Delete account</p>
            <p className="mt-2 text-sm text-red-600">
              This will remove your profile and orphan league teams. League
              history will remain for other members.
            </p>
            <button
              type="button"
              disabled
              className="mt-3 w-full rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-400"
            >
              Delete account (coming soon)
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            Beta & experimental
          </h2>
          <p className="text-sm text-zinc-500">
            Opt into early features and share feedback.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <span>Beta features</span>
            <input
              type="checkbox"
              disabled
              className="h-4 w-4 rounded border-zinc-300"
            />
          </label>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Build: {appVersion}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-zinc-500">
          <a
            href="mailto:wurnig@gmail.com"
            className="underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            Email feedback
          </a>
          <a
            href="https://discord.gg/FSkPdUF9"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            Join the Discord
          </a>
        </div>
      </section>
    </div>
  );
}
