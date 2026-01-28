"use client";

import { useEffect, useState, useTransition } from "react";
import SectionCard from "@/components/layout/section-card";
import LoadingState from "@/components/layout/loading-state";
import InlineError from "@/components/layout/inline-error";

type Settings = {
  joinMode: "OPEN" | "INVITE_ONLY";
  maxTeams: number;
  standingsMode: "TOTAL_POINTS" | "HEAD_TO_HEAD";
  draftMode: "LIVE" | "CASUAL" | "NONE";
  draftPickSeconds: number | null;
  draftScheduledAt: string | null;
};

type SettingsForm = {
  joinMode: Settings["joinMode"];
  maxTeams: string;
  standingsMode: Settings["standingsMode"];
  draftMode: Settings["draftMode"];
  draftPickSeconds: string;
  draftScheduledAt: string;
};

type Props = {
  leagueId: string;
  leagueName: string;
};

const formatLocalDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (entry: number) => String(entry).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const buildFormState = (settings: Settings): SettingsForm => {
  const draftSeconds =
    settings.draftMode === "LIVE" && settings.draftPickSeconds == null
      ? 60
      : settings.draftPickSeconds ?? "";
  return {
    joinMode: settings.joinMode,
    maxTeams: String(settings.maxTeams),
    standingsMode: settings.standingsMode,
    draftMode: settings.draftMode,
    draftPickSeconds:
      settings.draftMode === "LIVE" ? String(draftSeconds) : "",
    draftScheduledAt: formatLocalDateTimeInput(settings.draftScheduledAt),
  };
};

const presetDraftSeconds = [60, 180, 300, 600];

export default function SettingsClient({ leagueId, leagueName }: Props) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    let active = true;

    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setError(null);
      const res = await fetch(`/api/leagues/${leagueId}/settings`);
      const data = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        setError(data?.error ?? "Unable to load settings");
        return;
      }
      setLocked(Boolean(data?.locked));
      setForm(buildFormState(data.settings));
      setInviteCode(data?.inviteCode ?? null);
    };

    load();

    return () => {
      active = false;
    };
  }, [leagueId]);

  const updateField = <K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = () => {
    if (!form) return;
    setError(null);

    const maxTeams = Number(form.maxTeams);
    if (!Number.isInteger(maxTeams)) {
      setError("Max teams must be a whole number.");
      return;
    }

    let draftPickSeconds: number | null = null;
    let draftScheduledAt: string | null = null;
    if (form.draftMode === "LIVE") {
      draftPickSeconds = Number(form.draftPickSeconds);
      if (!Number.isInteger(draftPickSeconds)) {
        setError("Draft pick seconds must be a whole number.");
        return;
      }
      if (!form.draftScheduledAt) {
        setError("Draft schedule is required for live drafts.");
        return;
      }
      const parsed = new Date(form.draftScheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        setError("Draft schedule is invalid.");
        return;
      }
      draftScheduledAt = parsed.toISOString();
    }

    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinMode: form.joinMode,
          maxTeams,
          standingsMode: form.standingsMode,
          draftMode: form.draftMode,
          draftPickSeconds,
          draftScheduledAt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to save settings");
        return;
      }
      setForm(buildFormState(data.settings));
    });
  };

  const handleDelete = () => {
    setDeleteError(null);
    if (deleteConfirm.trim() !== leagueName.trim()) {
      setDeleteError("Type the league name to confirm deletion.");
      return;
    }

    startDelete(async () => {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(data?.error ?? "Unable to delete league");
        return;
      }
      window.location.href = "/leagues";
    });
  };

  if (!form) {
    return <LoadingState label="Loading settings…" />;
  }

  const draftPickSecondsNumber = Number(form.draftPickSeconds);
  const draftPickMinutesSelection = presetDraftSeconds.includes(
    draftPickSecondsNumber,
  )
    ? String(draftPickSecondsNumber / 60)
    : "OTHER";

  return (
    <div className="flex flex-col gap-6">
      {form.joinMode === "INVITE_ONLY" ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
              Invite code
            </h2>
            <p className="text-sm text-zinc-600">
              Share this code with the people you want to invite.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold tracking-[0.3em] text-zinc-900">
              {inviteCode ?? "—"}
            </span>
            {inviteCode ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteCode);
                    setInviteCopied(true);
                    window.setTimeout(() => setInviteCopied(false), 1800);
                  } catch (copyError) {
                    console.error("Unable to copy invite code", copyError);
                  }
                }}
                className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:border-zinc-300"
              >
                {inviteCopied ? "Copied" : "Copy code"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-600">
            Join mode
            <select
              value={form.joinMode}
              onChange={(event) =>
                updateField(
                  "joinMode",
                  event.target.value as SettingsForm["joinMode"],
                )
              }
              disabled={locked}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
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
              value={form.maxTeams}
              onChange={(event) => updateField("maxTeams", event.target.value)}
              disabled={locked}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-600">
            Standings mode
            <select
              value={form.standingsMode}
              onChange={(event) =>
                updateField(
                  "standingsMode",
                  event.target.value as SettingsForm["standingsMode"],
                )
              }
              disabled={locked}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
            >
              <option value="TOTAL_POINTS">Total points</option>
              <option value="HEAD_TO_HEAD">Head-to-head</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-600">
            Draft mode
            <select
              value={form.draftMode}
              onChange={(event) => {
                const value = event.target.value as SettingsForm["draftMode"];
                updateField("draftMode", value);
                if (value === "LIVE" && !form.draftPickSeconds) {
                  updateField("draftPickSeconds", "60");
                }
                if (value !== "LIVE") {
                  updateField("draftPickSeconds", "");
                  updateField("draftScheduledAt", "");
                }
              }}
              disabled={locked}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
            >
              <option value="LIVE">Live (timed)</option>
              <option value="CASUAL">Casual (untimed)</option>
              <option value="NONE">No draft</option>
            </select>
          </label>

          {form.draftMode === "LIVE" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-sm text-zinc-600">
                Draft start time
                <input
                  type="datetime-local"
                  value={form.draftScheduledAt}
                  onChange={(event) =>
                    updateField("draftScheduledAt", event.target.value)
                  }
                  disabled={locked}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
                />
                <span className="text-xs text-zinc-400">
                  Uses your local time.
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm text-zinc-600">
                Draft pick time
                <select
                  value={draftPickMinutesSelection}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "OTHER") {
                      updateField(
                        "draftPickSeconds",
                        presetDraftSeconds.includes(draftPickSecondsNumber)
                          ? ""
                          : form.draftPickSeconds,
                      );
                      return;
                    }
                    const minutes = Number(value);
                    updateField("draftPickSeconds", String(minutes * 60));
                  }}
                  disabled={locked}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
                >
                  <option value="1">1 minute</option>
                  <option value="3">3 minutes</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              {draftPickMinutesSelection === "OTHER" ? (
                <label className="flex flex-col gap-2 text-sm text-zinc-600">
                  Custom seconds
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={form.draftPickSeconds}
                    onChange={(event) =>
                      updateField("draftPickSeconds", event.target.value)
                    }
                    disabled={locked}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
        {locked ? (
          <p className="mt-4 text-xs text-zinc-500">
            Settings that affect gameplay are locked after the draft starts.
          </p>
        ) : null}
      </div>

      {error ? <InlineError message={error} /> : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || locked}
          className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/50"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
        <span className="text-xs text-zinc-500">
          Changes apply league-wide immediately.
        </span>
      </div>

      <SectionCard
        title="Danger zone"
        description="Deleting a league is permanent and removes all teams and drafts."
        tone="danger"
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
            Type <span className="font-semibold text-[var(--text)]">{leagueName}</span>{" "}
            to confirm
            <input
              type="text"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            />
          </label>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-fit rounded-2xl bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? "Deleting…" : "Delete league"}
          </button>
          {deleteError ? (
            <p className="rounded-2xl border border-[var(--danger)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--danger)]">
              {deleteError}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
