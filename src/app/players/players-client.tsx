"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getClubDisplayName } from "@/lib/clubs";
import { formatPlayerName } from "@/lib/players";

type Player = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: "GK" | "DEF" | "MID" | "FWD";
  club: { name: string; shortName: string | null; slug: string | null };
};

type Props = {
  players: Player[];
};

type SortOption = "NAME_ASC" | "CLUB_ASC" | "POSITION_ASC";

const positions: Array<Player["position"] | "ALL"> = [
  "ALL",
  "GK",
  "DEF",
  "MID",
  "FWD",
];

export default function PlayersClient({ players }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] =
    useState<(typeof positions)[number]>("ALL");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("NAME_ASC");

  const clubs = useMemo(() => {
    const clubMap = new Map<string, string>();
    players.forEach((player) => {
      const label = getClubDisplayName(player.club.slug, player.club.name);
      clubMap.set(player.club.name, label);
    });
    return Array.from(clubMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [players]);

  useEffect(() => {
    const query = searchParams.get("q") ?? "";
    const positionParam = searchParams.get("position") ?? "ALL";
    const clubParam = searchParams.get("club") ?? "ALL";
    const sortParam = searchParams.get("sort") ?? "NAME_ASC";

    const nextSearch = query.trim();
    const nextPosition = positions.includes(
      positionParam as (typeof positions)[number],
    )
      ? (positionParam as (typeof positions)[number])
      : "ALL";
    const clubKeys = new Set(clubs.map((club) => club.key));
    const nextClub =
      clubParam === "ALL" || clubKeys.has(clubParam) ? clubParam : "ALL";
    const nextSort =
      sortParam === "CLUB_ASC" ||
      sortParam === "POSITION_ASC" ||
      sortParam === "NAME_ASC"
        ? (sortParam as SortOption)
        : "NAME_ASC";

    if (nextSearch !== searchTerm) setSearchTerm(nextSearch);
    if (nextPosition !== positionFilter) setPositionFilter(nextPosition);
    if (nextClub !== clubFilter) setClubFilter(nextClub);
    if (nextSort !== sortOption) setSortOption(nextSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clubs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (positionFilter !== "ALL") params.set("position", positionFilter);
    if (clubFilter !== "ALL") params.set("club", clubFilter);
    if (sortOption !== "NAME_ASC") params.set("sort", sortOption);

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    const url = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(url, { scroll: false });
  }, [
    searchTerm,
    positionFilter,
    clubFilter,
    sortOption,
    pathname,
    router,
    searchParams,
  ]);

  const filteredPlayers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const nextPlayers = players.filter((player) => {
      const matchesPosition =
        positionFilter === "ALL" || player.position === positionFilter;
      const matchesClub =
        clubFilter === "ALL" || player.club.name === clubFilter;
      const matchesSearch =
        query.length === 0 ||
        player.name.toLowerCase().includes(query) ||
        (player.jerseyNumber !== null &&
          String(player.jerseyNumber).includes(query)) ||
        player.club.name.toLowerCase().includes(query) ||
        getClubDisplayName(player.club.slug, player.club.name)
          .toLowerCase()
          .includes(query) ||
        player.club.shortName?.toLowerCase().includes(query);
      return matchesPosition && matchesClub && matchesSearch;
    });

    return nextPlayers.sort((a, b) => {
      if (sortOption === "CLUB_ASC") {
        const clubCompare = getClubDisplayName(
          a.club.slug,
          a.club.name,
        ).localeCompare(getClubDisplayName(b.club.slug, b.club.name));
        if (clubCompare !== 0) return clubCompare;
      }
      if (sortOption === "POSITION_ASC") {
        const positionCompare = a.position.localeCompare(b.position);
        if (positionCompare !== 0) return positionCompare;
      }
      return a.name.localeCompare(b.name);
    });
  }, [players, positionFilter, clubFilter, searchTerm, sortOption]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Search
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by player or club"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] md:w-44">
            Position
            <select
              value={positionFilter}
              onChange={(event) =>
                setPositionFilter(
                  event.target.value as (typeof positions)[number],
                )
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
            >
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position === "ALL" ? "All positions" : position}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Club
            <select
              value={clubFilter}
              onChange={(event) => setClubFilter(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="ALL">All clubs</option>
              {clubs.map((club) => (
                <option key={club.key} value={club.key}>
                  {club.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Sort
            <select
              value={sortOption}
              onChange={(event) =>
                setSortOption(event.target.value as SortOption)
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="NAME_ASC">Name (A-Z)</option>
              <option value="CLUB_ASC">Club (A-Z)</option>
              <option value="POSITION_ASC">Position (A-Z)</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          <span>{filteredPlayers.length} players</span>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setPositionFilter("ALL");
              setClubFilter("ALL");
              setSortOption("NAME_ASC");
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-muted)]"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface2)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Club</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredPlayers.map((player) => (
              <tr key={player.id} className="text-[var(--text)]">
                <td className="px-4 py-3 font-semibold text-[var(--text)]">
                  {formatPlayerName(player.name, player.jerseyNumber)}
                </td>
                <td className="px-4 py-3">{player.position}</td>
                <td className="px-4 py-3">
                  {getClubDisplayName(player.club.slug, player.club.name)}
                </td>
              </tr>
            ))}
            {filteredPlayers.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-[var(--text-muted)]" colSpan={3}>
                  No players match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
