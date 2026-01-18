"use client";

import { useEffect, useState, useTransition } from "react";

type Settings = {
  joinMode: "OPEN" | "INVITE_ONLY";
  maxTeams: number;
  standingsMode: "TOTAL_POINTS" | "HEAD_TO_HEAD";
  draftMode: "ASYNC" | "TIMED";
  draftPickSeconds: number | null;
};

type SettingsForm = {
  joinMode: Settings["joinMode"];
  maxTeams: string;
  standingsMode: Settings["standingsMode"];
  draftMode: Settings["draftMode"];
  draftPickSeconds: string;
};

type Props = {
  leagueId: string;
  leagueName: string;
};

const buildFormState = (settings: Settings): SettingsForm => {
  const draftSeconds =
    settings.draftMode === "TIMED" && settings.draftPickSeconds == null
      ? 60
      : settings.draftPickSeconds ?? "";
  return {
    joinMode: settings.joinMode,
    maxTeams: String(settings.maxTeams),
    standingsMode: settings.standingsMode,
    draftMode: settings.draftMode,
    draftPickSeconds:
      settings.draftMode === "TIMED" ? String(draftSeconds) : "",
  };
};

export default function SettingsClient({ leagueId, leagueName }: Props) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    let active = true;
    setError(null);

    const load = async () => {
      const res = await fetch(`/api/leagues/${leagueId}/settings`);
      const data = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        setError(data?.error ?? "Unable to load settings");
        return;
      }
      setLocked(Boolean(data?.locked));
      setForm(buildFormState(data.settings));
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
    if (form.draftMode === "TIMED") {
      draftPickSeconds = Number(form.draftPickSeconds);
      if (!Number.isInteger(draftPickSeconds)) {
        setError("Draft pick seconds must be a whole number.");
        return;
      }
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
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-600">
            Join mode
            <select
              value={form.joinMode}
              onChange={(event) =>
                updateField("joinMode", event.target.value as SettingsForm["joinMode"])
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
                if (value === "TIMED" && !form.draftPickSeconds) {
                  updateField("draftPickSeconds", "60");
                }
                if (value === "ASYNC") {
                  updateField("draftPickSeconds", "");
                }
              }}
              disabled={locked}
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
            >
              <option value="ASYNC">Async</option>
              <option value="TIMED">Timed</option>
            </select>
          </label>

          {form.draftMode === "TIMED" ? (
            <label className="flex flex-col gap-2 text-sm text-zinc-600">
              Draft pick seconds
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
        {locked ? (
          <p className="mt-4 text-xs text-zinc-500">
            Settings that affect gameplay are locked after the draft starts.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

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

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">
            Danger zone
          </h2>
          <p className="text-sm text-red-700">
            Deleting a league is permanent and removes all teams and drafts.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-red-700">
            Type <span className="font-semibold">{leagueName}</span> to confirm
            <input
              type="text"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm text-red-900"
            />
          </label>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-fit rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {isDeleting ? "Deleting…" : "Delete league"}
          </button>
          {deleteError ? (
            <p className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              {deleteError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
