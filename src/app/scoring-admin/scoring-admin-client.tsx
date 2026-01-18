"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEasternDateTime } from "@/lib/time";

type MatchWeekOption = {
  id: string;
  number: number;
  name: string | null;
  status: "OPEN" | "LOCKED" | "FINALIZED";
};

type SeasonOption = {
  id: string;
  year: number;
  name: string;
  isActive: boolean;
};

type ClubOption = {
  slug: string;
  name: string;
  shortName: string | null;
};

type MatchWeekPlayer = {
  id: string;
  name: string;
  position: string;
  clubLabel: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  cleanSheet: boolean;
};

type MatchWeekMatch = {
  id: string;
  kickoffAt: string;
  status: string;
  homeClub: { slug: string; shortName: string | null; name: string };
  awayClub: { slug: string; shortName: string | null; name: string };
  homePlayers: MatchWeekPlayer[];
  awayPlayers: MatchWeekPlayer[];
};

type Row = {
  id: string;
  playerId: string;
  playerName: string;
  position: string;
  clubLabel: string;
  side: "home" | "away";
  minutes: string;
  goals: string;
  assists: string;
  yellowCards: string;
  redCards: string;
  ownGoals: string;
  cleanSheet: boolean;
};

type Props = {
  postUrl: string;
  players: Array<{
    id: string;
    name: string;
    position: string;
    clubLabel: string;
  }>;
  matchWeeks: MatchWeekOption[];
  seasons: SeasonOption[];
  clubs: ClubOption[];
  canWrite: boolean;
  isAdmin: boolean;
};

type ScheduleSummary = {
  importedCount: number;
  updatedCount: number;
  createdCount: number;
  matchWeeksCreatedCount: number;
  lockAtUpdatedCount: number;
  createdMatchWeeks?: MatchWeekOption[];
  season: { id: string; year: number; name: string };
};

type ScheduleError = {
  row: number;
  field: string;
  message: string;
};

type MatchRow = {
  id: string;
  externalId: string;
  kickoffAt: string;
  status: string;
  matchWeekNumber: number | null;
  homeClub: { slug: string; shortName: string | null; name: string };
  awayClub: { slug: string; shortName: string | null; name: string };
};

const matchStatusOptions = [
  "SCHEDULED",
  "POSTPONED",
  "COMPLETED",
  "CANCELED",
];

const parseNumber = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

export default function ScoringAdminClient({
  postUrl,
  players,
  matchWeeks,
  seasons,
  clubs,
  canWrite,
  isAdmin,
}: Props) {
  const initialMatchWeek =
    matchWeeks.length > 0 ? String(matchWeeks[0].number) : "1";
  const initialSeasonId =
    seasons.find((season) => season.isActive)?.id ?? seasons[0]?.id ?? "";
  const [matchWeekNumber, setMatchWeekNumber] =
    useState<string>(initialMatchWeek);
  const [matchWeekOptions, setMatchWeekOptions] =
    useState<MatchWeekOption[]>(matchWeeks);
  const [scheduleSeasonId, setScheduleSeasonId] =
    useState<string>(initialSeasonId);
  const [matchesSeasonId] = useState<string>(initialSeasonId);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchWeekMessage, setMatchWeekMessage] = useState<string | null>(null);
  const [matchWeekError, setMatchWeekError] = useState<string | null>(null);
  const [matchWeekMatches, setMatchWeekMatches] = useState<MatchWeekMatch[]>([]);
  const [matchWeekMatchesError, setMatchWeekMatchesError] =
    useState<string | null>(null);
  const [isLoadingMatchWeekMatches, setIsLoadingMatchWeekMatches] =
    useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [scheduleSummary, setScheduleSummary] =
    useState<ScheduleSummary | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<ScheduleError[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchWeekFilter, setMatchWeekFilter] = useState<string>("");
  const [clubFilter, setClubFilter] = useState<string>("");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingKickoffAt, setEditingKickoffAt] = useState<string>("");
  const [editingMatchWeekNumber, setEditingMatchWeekNumber] =
    useState<string>("");
  const [editingStatus, setEditingStatus] = useState<string>("SCHEDULED");
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingMatchWeek, setIsUpdatingMatchWeek] = useState(false);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);

  const seasonOptions = useMemo(() => seasons, [seasons]);
  const clubOptions = useMemo(() => clubs, [clubs]);

  const updateRow = (rowId: string, update: Partial<Row>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...update } : row)),
    );
  };

  const toTextValue = (value: number) => (value > 0 ? String(value) : "");

  const buildRows = (match: MatchWeekMatch): Row[] => {
    const mapPlayers = (players: MatchWeekPlayer[], side: "home" | "away") =>
      players.map((player) => ({
        id: player.id,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        clubLabel: player.clubLabel,
        side,
        minutes: toTextValue(player.minutes),
        goals: toTextValue(player.goals),
        assists: toTextValue(player.assists),
        yellowCards: toTextValue(player.yellowCards),
        redCards: toTextValue(player.redCards),
        ownGoals: toTextValue(player.ownGoals),
        cleanSheet: player.cleanSheet,
      }));

    return [
      ...mapPlayers(match.homePlayers, "home"),
      ...mapPlayers(match.awayPlayers, "away"),
    ];
  };

  const submit = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const normalizedStats = rows
        .map((row, index) => {
          const hasAnyInput =
            row.minutes.trim() ||
            row.goals.trim() ||
            row.assists.trim() ||
            row.yellowCards.trim() ||
            row.redCards.trim() ||
            row.ownGoals.trim() ||
            row.cleanSheet;

          if (!hasAnyInput) {
            return null;
          }

          const minutes = parseNumber(row.minutes);
          if (minutes === null) {
            return { error: `Row ${index + 1}: minutes are required.` };
          }

          const goals = parseNumber(row.goals) ?? 0;
          const assists = parseNumber(row.assists) ?? 0;
          const yellowCards = parseNumber(row.yellowCards) ?? 0;
          const redCards = parseNumber(row.redCards) ?? 0;
          const ownGoals = parseNumber(row.ownGoals) ?? 0;

          return {
            playerId: row.playerId,
            minutes,
            goals,
            assists,
            yellowCards,
            redCards,
            ownGoals,
            cleanSheet: row.cleanSheet,
          };
        })
        .filter((entry) => entry !== null);

      const firstError = normalizedStats.find(
        (entry): entry is { error: string } => "error" in entry,
      );

      if (firstError) {
        setError(firstError.error);
        return;
      }

      const stats = normalizedStats.filter(
        (entry): entry is Exclude<typeof entry, { error: string }> =>
          !("error" in entry),
      );

      if (!stats.length) {
        setError("Add at least one stat row before saving.");
        return;
      }

      const matchWeekValue = parseNumber(matchWeekNumber);
      if (!matchWeekValue || matchWeekValue <= 0) {
        setError("Select a valid MatchWeek.");
        return;
      }

      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchWeekNumber: matchWeekValue,
          stats,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setError(payload?.error ?? "Unable to save stats");
        return;
      }

      setMessage(`Saved ${payload?.upserted ?? 0} stat rows.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMatches = useCallback(async () => {
    if (!matchesSeasonId) return;
    if (!isAdmin) return;

    setIsLoadingMatches(true);
    setMatchesError(null);

    try {
      const params = new URLSearchParams();
      params.set("seasonId", matchesSeasonId);

      const matchWeekValue = parseNumber(matchWeekFilter);
      if (matchWeekValue && matchWeekValue > 0) {
        params.set("matchWeekNumber", String(matchWeekValue));
      }

      if (clubFilter) {
        params.set("clubSlug", clubFilter);
      }

      if (dateFromFilter) {
        params.set("dateFrom", dateFromFilter);
      }

      if (dateToFilter) {
        params.set("dateTo", dateToFilter);
      }

      const res = await fetch(`/api/admin/matches?${params.toString()}`);
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setMatchesError(payload?.error ?? "Unable to load matches.");
        return;
      }

      setMatches((payload?.matches as MatchRow[]) ?? []);
    } catch (loadError) {
      console.error("loadMatches error", loadError);
      setMatchesError("Unable to load matches.");
    } finally {
      setIsLoadingMatches(false);
    }
  }, [
    clubFilter,
    dateFromFilter,
    dateToFilter,
    isAdmin,
    matchWeekFilter,
    matchesSeasonId,
  ]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const selectedMatchWeekNumber = parseNumber(matchWeekNumber);
  const selectedMatchWeek = selectedMatchWeekNumber
    ? matchWeekOptions.find((week) => week.number === selectedMatchWeekNumber)
    : undefined;
  const selectedMatch = useMemo(
    () => matchWeekMatches.find((match) => match.id === selectedMatchId),
    [matchWeekMatches, selectedMatchId],
  );

  const updateMatchWeekOptions = (updated: MatchWeekOption) => {
    setMatchWeekOptions((current) => {
      const existingIndex = current.findIndex((week) => week.id === updated.id);
      if (existingIndex === -1) {
        return [...current, updated].sort((a, b) => a.number - b.number);
      }
      return current.map((week) => (week.id === updated.id ? updated : week));
    });
  };

  const handleMatchWeekAction = async (
    endpoint: "open" | "lock" | "finalize",
  ) => {
    setMatchWeekError(null);
    setMatchWeekMessage(null);
    setIsUpdatingMatchWeek(true);

    try {
      const payload =
        endpoint === "open"
          ? { number: selectedMatchWeekNumber }
          : { matchWeekId: selectedMatchWeek?.id };

      const res = await fetch(`/api/admin/matchweeks/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMatchWeekError(data?.error ?? "Unable to update MatchWeek");
        return;
      }

      if (data?.matchWeek) {
        updateMatchWeekOptions(data.matchWeek as MatchWeekOption);
      }

      setMatchWeekMessage(
        endpoint === "open"
          ? "MatchWeek opened."
          : endpoint === "lock"
            ? "MatchWeek locked."
            : "MatchWeek finalized.",
      );
    } finally {
      setIsUpdatingMatchWeek(false);
    }
  };

  const submitSchedule = async () => {
    if (!scheduleFile) {
      setScheduleError("Select a CSV file to import.");
      return;
    }

    if (!scheduleSeasonId) {
      setScheduleError("Select a season before importing.");
      return;
    }

    setIsImportingSchedule(true);
    setScheduleError(null);
    setScheduleErrors([]);
    setScheduleSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", scheduleFile);
      formData.append("seasonId", scheduleSeasonId);

      const res = await fetch("/api/admin/schedule/import", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        if (payload?.errors) {
          setScheduleErrors(payload.errors as ScheduleError[]);
        } else {
          setScheduleError(payload?.error ?? "Unable to import schedule.");
        }
        return;
      }

      setScheduleSummary(payload as ScheduleSummary);
      if (
        payload?.createdMatchWeeks?.length &&
        scheduleSeasonId === matchesSeasonId
      ) {
        const created = payload.createdMatchWeeks as MatchWeekOption[];
        setMatchWeekOptions((current) => {
          const existingNumbers = new Set(current.map((mw) => mw.number));
          const merged = [
            ...current,
            ...created.filter((mw) => !existingNumbers.has(mw.number)),
          ];
          return merged.sort((a, b) => a.number - b.number);
        });
      }
      void loadMatches();
    } finally {
      setIsImportingSchedule(false);
    }
  };

  const loadMatchWeekMatches = useCallback(async () => {
    if (!selectedMatchWeek?.id) {
      setMatchWeekMatches([]);
      setRows([]);
      setSelectedMatchId("");
      return;
    }

    setIsLoadingMatchWeekMatches(true);
    setMatchWeekMatchesError(null);

    try {
      const res = await fetch(
        `/api/admin/matchweeks/matches?matchWeekId=${selectedMatchWeek.id}`,
      );
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setMatchWeekMatchesError(payload?.error ?? "Unable to load matches.");
        setMatchWeekMatches([]);
        setRows([]);
        setSelectedMatchId("");
        return;
      }

      const loadedMatches = (payload?.matches ?? []) as MatchWeekMatch[];
      setMatchWeekMatches(loadedMatches);
      setSelectedMatchId(loadedMatches[0]?.id ?? "");
    } catch (loadError) {
      console.error("loadMatchWeekMatches error", loadError);
      setMatchWeekMatchesError("Unable to load matches.");
      setMatchWeekMatches([]);
      setRows([]);
      setSelectedMatchId("");
    } finally {
      setIsLoadingMatchWeekMatches(false);
    }
  }, [selectedMatchWeek?.id]);

  useEffect(() => {
    void loadMatchWeekMatches();
  }, [loadMatchWeekMatches]);

  useEffect(() => {
    if (!selectedMatch) {
      setRows([]);
      return;
    }
    setRows(buildRows(selectedMatch));
  }, [selectedMatch]);

  const startEditingMatch = (match: MatchRow) => {
    setEditingMatchId(match.id);
    setEditingKickoffAt(formatEasternDateTime(new Date(match.kickoffAt)));
    setEditingMatchWeekNumber(
      match.matchWeekNumber ? String(match.matchWeekNumber) : "",
    );
    setEditingStatus(match.status);
    setMatchesError(null);
  };

  const cancelEditingMatch = () => {
    setEditingMatchId(null);
  };

  const saveMatchEdit = async () => {
    if (!editingMatchId) return;

    const matchWeekValue = parseNumber(editingMatchWeekNumber);
    if (!matchWeekValue || matchWeekValue <= 0) {
      setMatchesError("MatchWeek number must be a positive integer.");
      return;
    }

    if (!editingKickoffAt.trim()) {
      setMatchesError("Kickoff time is required.");
      return;
    }

    if (!matchStatusOptions.includes(editingStatus)) {
      setMatchesError("Select a valid match status.");
      return;
    }

    setIsSavingMatch(true);
    setMatchesError(null);

    try {
      const res = await fetch(`/api/admin/matches/${editingMatchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kickoffAtEastern: editingKickoffAt,
          matchWeekNumber: matchWeekValue,
          status: editingStatus,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setMatchesError(payload?.error ?? "Unable to update match.");
        return;
      }

      setEditingMatchId(null);
      void loadMatches();
    } finally {
      setIsSavingMatch(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Dev-only tools
        </p>
        <p className="mt-2 text-sm text-zinc-800">
          This endpoint is gated by `ALLOW_DEV_STAT_WRITES=true`.
        </p>
        {!canWrite ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Writes are disabled. Set `ALLOW_DEV_STAT_WRITES=true` to enable
            saving.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              MatchWeek controls
            </p>
            <p className="text-xs text-zinc-700">
              Manage the lifecycle for the selected MatchWeek.
            </p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Status: {selectedMatchWeek?.status ?? "Unknown"}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleMatchWeekAction("open")}
            disabled={
              !selectedMatchWeekNumber ||
              selectedMatchWeekNumber <= 0 ||
              isUpdatingMatchWeek
            }
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
          >
            Open MatchWeek
          </button>
          <button
            type="button"
            onClick={() => handleMatchWeekAction("lock")}
            disabled={
              !selectedMatchWeek ||
              selectedMatchWeek.status !== "OPEN" ||
              isUpdatingMatchWeek
            }
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
          >
            Lock MatchWeek
          </button>
          <button
            type="button"
            onClick={() => handleMatchWeekAction("finalize")}
            disabled={
              !selectedMatchWeek ||
              selectedMatchWeek.status === "FINALIZED" ||
              isUpdatingMatchWeek
            }
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
          >
            Finalize MatchWeek
          </button>
        </div>
        {matchWeekError ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            {matchWeekError}
          </p>
        ) : null}
        {matchWeekMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {matchWeekMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">MatchWeek</p>
            <p className="text-xs text-zinc-700">
              Select the matchweek to upsert stats.
            </p>
          </div>
          {matchWeekOptions.length > 0 ? (
            <select
              value={matchWeekNumber}
              onChange={(event) => setMatchWeekNumber(event.target.value)}
              className="min-w-[180px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {matchWeekOptions.map((matchWeek) => (
                <option key={matchWeek.id} value={matchWeek.number}>
                  {matchWeek.name
                    ? `${matchWeek.name} (${matchWeek.number})`
                    : `MatchWeek ${matchWeek.number}`}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col items-end gap-2 text-right">
              <input
                type="number"
                min="1"
                value={matchWeekNumber}
                onChange={(event) => setMatchWeekNumber(event.target.value)}
                className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              />
              <p className="text-xs text-zinc-700">
                No MatchWeeks yet. Enter a number.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
            Player stats
          </h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Match in MatchWeek
            </label>
            <select
              value={selectedMatchId}
              onChange={(event) => setSelectedMatchId(event.target.value)}
              disabled={!matchWeekMatches.length}
              className="min-w-[220px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
            >
              {matchWeekMatches.length === 0 ? (
                <option value="">
                  {isLoadingMatchWeekMatches
                    ? "Loading matches..."
                    : "No matches found"}
                </option>
              ) : null}
              {matchWeekMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.homeClub.shortName ?? match.homeClub.name} vs{" "}
                  {match.awayClub.shortName ?? match.awayClub.name} ·{" "}
                  {formatEasternDateTime(new Date(match.kickoffAt))}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void loadMatchWeekMatches()}
            disabled={!selectedMatchWeek?.id || isLoadingMatchWeekMatches}
            className="mt-5 rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
          >
            {isLoadingMatchWeekMatches ? "Refreshing…" : "Refresh matches"}
          </button>
        </div>

        {matchWeekMatchesError ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            {matchWeekMatchesError}
          </p>
        ) : null}

        {selectedMatch ? (
          <div className="mt-4 flex flex-col gap-4">
            {(["home", "away"] as const).map((side) => {
              const sideRows = rows.filter((row) => row.side === side);
              const club =
                side === "home"
                  ? selectedMatch.homeClub
                  : selectedMatch.awayClub;

              return (
                <div key={side} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      {side === "home" ? "Home" : "Away"} roster ·{" "}
                      {club.shortName ?? club.name}
                    </p>
                    <span className="text-xs uppercase tracking-wide text-zinc-500">
                      {sideRows.length} players
                    </span>
                  </div>
                  <div className="mt-3 max-h-[420px] overflow-x-auto overflow-y-auto pb-2 pr-2">
                    <div className="flex flex-col gap-4">
                      {sideRows.map((row) => (
                        <div
                          key={row.id}
                          className="grid min-w-full grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:min-w-[1080px] md:grid-cols-[2fr_repeat(6,1fr)_auto]"
                        >
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              Player
                            </label>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                              {row.playerName} · {row.position}
                              {row.clubLabel ? ` · ${row.clubLabel}` : ""}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              Min
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.minutes}
                              onChange={(event) =>
                                updateRow(row.id, { minutes: event.target.value })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              G
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.goals}
                              onChange={(event) =>
                                updateRow(row.id, { goals: event.target.value })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              A
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.assists}
                              onChange={(event) =>
                                updateRow(row.id, { assists: event.target.value })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              YC
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.yellowCards}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  yellowCards: event.target.value,
                                })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              RC
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.redCards}
                              onChange={(event) =>
                                updateRow(row.id, { redCards: event.target.value })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              OG
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={row.ownGoals}
                              onChange={(event) =>
                                updateRow(row.id, { ownGoals: event.target.value })
                              }
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                              <input
                                type="checkbox"
                                checked={row.cleanSheet}
                                onChange={(event) =>
                                  updateRow(row.id, {
                                    cleanSheet: event.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-zinc-300"
                              />
                              CS
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Select a match to load club rosters.
          </p>
        )}

        {error ? (
          <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || !canWrite}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save stats"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
            Schedule import
          </h3>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            CSV upload
          </p>
        </div>
        <p className="mt-2 text-sm text-zinc-700">
          Expected columns: seasonYear, externalId, kickoffAtEastern,
          homeClubSlug, awayClubSlug, matchWeekNumber, status.
        </p>
        {!isAdmin ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Admin access required to import schedules.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={scheduleSeasonId}
            onChange={(event) => setScheduleSeasonId(event.target.value)}
            disabled={!isAdmin || isImportingSchedule}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 sm:max-w-[220px]"
          >
            {seasonOptions.map((season) => (
              <option key={season.id} value={season.id}>
                {season.year} · {season.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              setScheduleFile(event.target.files?.[0] ?? null)
            }
            disabled={!isAdmin || isImportingSchedule}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submitSchedule}
            disabled={!isAdmin || !scheduleFile || isImportingSchedule}
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isImportingSchedule ? "Importing…" : "Import schedule CSV"}
          </button>
        </div>

        {scheduleError ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            {scheduleError}
          </p>
        ) : null}

        {scheduleErrors.length > 0 ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-semibold">
              Fix the following errors and try again:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {scheduleErrors.map((issue, index) => (
                <li key={`${issue.row}-${issue.field}-${index}`}>
                  Row {issue.row} · {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

      {scheduleSummary ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p className="font-semibold">Schedule import complete.</p>
            <p className="mt-1">
              {scheduleSummary.season.name} · {scheduleSummary.season.year}
            </p>
            <p className="mt-1">
              Imported {scheduleSummary.importedCount} matches (created{" "}
              {scheduleSummary.createdCount}, updated{" "}
              {scheduleSummary.updatedCount}).
            </p>
            <p className="mt-1">
              MatchWeeks created: {scheduleSummary.matchWeeksCreatedCount}. Lock
              times updated: {scheduleSummary.lockAtUpdatedCount}.
            </p>
            {scheduleSummary.createdMatchWeeks &&
            scheduleSummary.createdMatchWeeks.length > 0 ? (
              <p className="mt-1">
                Created MatchWeeks:{" "}
                {scheduleSummary.createdMatchWeeks
                  .map((matchWeek) => matchWeek.number)
                  .join(", ")}
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
            Matches
          </h3>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Times shown in ET
          </p>
        </div>
        {!isAdmin ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Admin access required to view or edit matches.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <select
            value={matchWeekFilter}
            onChange={(event) => setMatchWeekFilter(event.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
          >
            <option value="">All matchweeks</option>
            {matchWeekOptions.map((matchWeek) => (
              <option key={matchWeek.id} value={String(matchWeek.number)}>
                MW {matchWeek.number}
              </option>
            ))}
          </select>
          <select
            value={clubFilter}
            onChange={(event) => setClubFilter(event.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
          >
            <option value="">All clubs</option>
            {clubOptions.map((club) => (
              <option key={club.slug} value={club.slug}>
                {club.shortName ?? club.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFromFilter}
            onChange={(event) => setDateFromFilter(event.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
          />
          <input
            type="date"
            value={dateToFilter}
            onChange={(event) => setDateToFilter(event.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-600">
          <p>Filter by MatchWeek, club, or date range.</p>
          <button
            type="button"
            onClick={() => void loadMatches()}
            disabled={!isAdmin || isLoadingMatches}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
          >
            {isLoadingMatches ? "Loading…" : "Refresh"}
          </button>
        </div>

        {matchesError ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            {matchesError}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Kickoff (ET)</th>
                <th className="py-2 pr-4">Home</th>
                <th className="py-2 pr-4">Away</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">MatchWeek</th>
                <th className="py-2 pr-4">External ID</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800">
              {matches.map((match) => {
                const isEditing = editingMatchId === match.id;
                return (
                  <tr key={match.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingKickoffAt}
                          onChange={(event) =>
                            setEditingKickoffAt(event.target.value)
                          }
                          className="w-[170px] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
                        />
                      ) : (
                        formatEasternDateTime(new Date(match.kickoffAt))
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {match.homeClub.shortName ?? match.homeClub.name}
                    </td>
                    <td className="py-2 pr-4">
                      {match.awayClub.shortName ?? match.awayClub.name}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <select
                          value={editingStatus}
                          onChange={(event) =>
                            setEditingStatus(event.target.value)
                          }
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
                        >
                          {matchStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        match.status
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editingMatchWeekNumber}
                          onChange={(event) =>
                            setEditingMatchWeekNumber(event.target.value)
                          }
                          className="w-[90px] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
                        />
                      ) : match.matchWeekNumber ? (
                        `MW ${match.matchWeekNumber}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                      {match.externalId}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveMatchEdit}
                            disabled={isSavingMatch}
                            className="rounded-full bg-black px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                          >
                            {isSavingMatch ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingMatch}
                            disabled={isSavingMatch}
                            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingMatch(match)}
                          disabled={!isAdmin}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 disabled:opacity-60"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isLoadingMatches && matches.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">No matches found.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
