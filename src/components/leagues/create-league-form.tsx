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

type CreateLeagueFormProps = {
  onCreated?: (leagueId?: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  submitLabel?: string;
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

export default function CreateLeagueForm({
  onCreated,
  onCancel,
  showCancel = false,
  submitLabel = "Create league",
}: CreateLeagueFormProps) {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [createSettings, setCreateSettings] = useState<CreateSettingsForm>(
    defaultCreateSettings,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      if (leagueId) {
        router.push(`/leagues/${leagueId}`);
      } else {
        router.refresh();
      }
      onCreated?.(leagueId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create league");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
        League name
        <input
          type="text"
          name="name"
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          placeholder="League name"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
          Join mode
          <select
            value={createSettings.joinMode}
            onChange={(event) =>
              setCreateSettings((current) => ({
                ...current,
                joinMode: event.target.value as CreateSettingsForm["joinMode"],
              }))
            }
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="OPEN">Open</option>
            <option value="INVITE_ONLY">Invite only</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
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
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
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
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="TOTAL_POINTS">Total points</option>
            <option value="HEAD_TO_HEAD">Head-to-head</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
          Draft mode
          <select
            value={createSettings.draftMode}
            onChange={(event) => {
              const value = event.target.value as CreateSettingsForm["draftMode"];
              setCreateSettings((current) => ({
                ...current,
                draftMode: value,
                draftPickSeconds:
                  value === "LIVE" ? current.draftPickSeconds || "60" : "",
                draftScheduledAt:
                  value === "LIVE" ? current.draftScheduledAt : "",
              }));
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="LIVE">Live (timed)</option>
            <option value="CASUAL">Casual (untimed)</option>
            <option value="NONE">No draft</option>
          </select>
        </label>

        {createSettings.draftMode === "LIVE" ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
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
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              />
              <span className="text-xs text-[var(--text-muted)]">
                Uses your local time.
              </span>
            </label>
            <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
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
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="1">1 minute</option>
                <option value="3">3 minutes</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            {!presetDraftSeconds.includes(Number(createSettings.draftPickSeconds)) ? (
              <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
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
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-600 bg-[var(--surface)] px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed"
          >
            {pending ? "Creating..." : submitLabel}
          </button>
          {showCancel && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          ) : null}
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          You can update settings before the draft starts.
        </span>
      </div>
    </form>
  );
}
