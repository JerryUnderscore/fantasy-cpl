"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateSettingsForm = {
  joinMode: "OPEN" | "INVITE_ONLY";
  maxTeams: string;
  standingsMode: "TOTAL_POINTS" | "HEAD_TO_HEAD";
  draftMode: "LIVE" | "CASUAL" | "NONE";
  draftPickSeconds: string;
  draftScheduledAt: string;
};

const defaultCreateSettings: CreateSettingsForm = {
  joinMode: "OPEN",
  maxTeams: "8",
  standingsMode: "TOTAL_POINTS",
  draftMode: "CASUAL",
  draftPickSeconds: "",
  draftScheduledAt: "",
};

const presetDraftSeconds = [60, 180, 300, 600];

export default function LeagueActions() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [createSettings, setCreateSettings] = useState<CreateSettingsForm>(
    defaultCreateSettings,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenCreate = () => {
    setError(null);
    setCreateOpen(true);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const name = createName.trim();
    if (!name) {
      setError("League name is required.");
      return;
    }

    const maxTeams = Number(createSettings.maxTeams);
    if (!Number.isInteger(maxTeams)) {
      setError("Max teams must be a whole number.");
      return;
    }

    let draftPickSeconds: number | null = null;
    let draftScheduledAt: string | null = null;
    if (createSettings.draftMode === "LIVE") {
      draftPickSeconds = Number(createSettings.draftPickSeconds);
      if (!Number.isInteger(draftPickSeconds)) {
        setError("Draft pick seconds must be a whole number.");
        return;
      }
      if (!createSettings.draftScheduledAt) {
        setError("Draft schedule is required for live drafts.");
        return;
      }
      const parsed = new Date(createSettings.draftScheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        setError("Draft schedule is invalid.");
        return;
      }
      draftScheduledAt = parsed.toISOString();
    }

    setPending(true);

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          joinMode: createSettings.joinMode,
          maxTeams,
          standingsMode: createSettings.standingsMode,
          draftMode: createSettings.draftMode,
          draftPickSeconds,
          draftScheduledAt,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to create league");
      }

      const payload = await response.json().catch(() => null);
      const leagueId = payload?.leagueId as string | undefined;

      setCreateName("");
      setCreateSettings(defaultCreateSettings);
      setCreateOpen(false);
      if (leagueId) {
        router.push(`/leagues/${leagueId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create league");
    } finally {
      setPending(false);
    }
  };

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to join league");
      }

      setJoinCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join league");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Create a league</h2>
        <p className="text-sm text-zinc-500">
          Choose your league settings before creating.
        </p>
        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={pending}
          className="w-fit rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/50"
        >
          Create
        </button>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Join a league</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="inviteCode"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Invite code"
            className="flex-1 rounded-2xl border border-zinc-200 px-4 py-2 text-sm uppercase tracking-wide"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Join
          </button>
        </div>
      </form>

      {error && !createOpen ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  League settings
                </h2>
                <p className="text-sm text-zinc-500">
                  Pick your defaults before creating the league.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setError(null);
                }}
                className="text-sm font-semibold text-zinc-400 hover:text-zinc-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-5 flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm text-zinc-600">
                League name
                <input
                  type="text"
                  name="name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="League name"
                  className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm text-zinc-900"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-zinc-600">
                  Join mode
                  <select
                    value={createSettings.joinMode}
                    onChange={(event) =>
                      setCreateSettings((current) => ({
                        ...current,
                        joinMode: event.target
                          .value as CreateSettingsForm["joinMode"],
                      }))
                    }
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="OPEN">Open</option>
                    <option value="INVITE_ONLY">Invite only</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm text-zinc-600">
                  Max teams
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={createSettings.maxTeams}
                    onChange={(event) =>
                      setCreateSettings((current) => ({
                        ...current,
                        maxTeams: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-zinc-600">
                  Standings mode
                  <select
                    value={createSettings.standingsMode}
                    onChange={(event) =>
                      setCreateSettings((current) => ({
                        ...current,
                        standingsMode: event.target
                          .value as CreateSettingsForm["standingsMode"],
                      }))
                    }
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="TOTAL_POINTS">Total points</option>
                    <option value="HEAD_TO_HEAD">Head-to-head</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm text-zinc-600">
                  Draft mode
                  <select
                    value={createSettings.draftMode}
                    onChange={(event) => {
                      const value = event.target
                        .value as CreateSettingsForm["draftMode"];
                      setCreateSettings((current) => ({
                        ...current,
                        draftMode: value,
                        draftPickSeconds:
                          value === "LIVE"
                            ? current.draftPickSeconds || "60"
                            : "",
                        draftScheduledAt: value === "LIVE" ? current.draftScheduledAt : "",
                      }));
                    }}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="LIVE">Live (timed)</option>
                    <option value="CASUAL">Casual (untimed)</option>
                    <option value="NONE">No draft</option>
                  </select>
                </label>

                {createSettings.draftMode === "LIVE" ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-2 text-sm text-zinc-600">
                      Draft start time
                      <input
                        type="datetime-local"
                        value={createSettings.draftScheduledAt}
                        onChange={(event) =>
                          setCreateSettings((current) => ({
                            ...current,
                            draftScheduledAt: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                      />
                      <span className="text-xs text-zinc-400">
                        Uses your local time.
                      </span>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-600">
                      Draft pick time
                      <select
                        value={
                          presetDraftSeconds.includes(
                            Number(createSettings.draftPickSeconds),
                          )
                            ? String(Number(createSettings.draftPickSeconds) / 60)
                            : "OTHER"
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "OTHER") {
                            setCreateSettings((current) => ({
                              ...current,
                              draftPickSeconds: presetDraftSeconds.includes(
                                Number(current.draftPickSeconds),
                              )
                                ? ""
                                : current.draftPickSeconds,
                            }));
                            return;
                          }
                          const minutes = Number(value);
                          setCreateSettings((current) => ({
                            ...current,
                            draftPickSeconds: String(minutes * 60),
                          }));
                        }}
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                      >
                        <option value="1">1 minute</option>
                        <option value="3">3 minutes</option>
                        <option value="5">5 minutes</option>
                        <option value="10">10 minutes</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    {!presetDraftSeconds.includes(
                      Number(createSettings.draftPickSeconds),
                    ) ? (
                      <label className="flex flex-col gap-2 text-sm text-zinc-600">
                        Custom seconds
                        <input
                          type="number"
                          min={10}
                          max={600}
                          value={createSettings.draftPickSeconds}
                          onChange={(event) =>
                            setCreateSettings((current) => ({
                              ...current,
                              draftPickSeconds: event.target.value,
                            }))
                          }
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/50"
                >
                  {pending ? "Creating..." : "Create league"}
                </button>
                <span className="text-xs text-zinc-500">
                  You can update settings before the draft starts.
                </span>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
