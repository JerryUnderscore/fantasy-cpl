"use client";

import { useMemo, useState } from "react";
import SectionCard from "@/components/layout/section-card";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";

type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

type TeamPick = {
  id: string;
  pickNumber: number;
  round: number;
  slotInRound: number;
  player: {
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  };
};

type SortOption = "DRAFT" | "NAME" | "POSITION";

const positionOrder: Record<PlayerPosition, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

export default function MyTeamPanel({ picks }: { picks: TeamPick[] }) {
  const [sortOption, setSortOption] = useState<SortOption>("DRAFT");

  const sortedPicks = useMemo(() => {
    const list = [...picks];
    switch (sortOption) {
      case "NAME":
        return list.sort((a, b) => {
          const nameCompare = a.player.name.localeCompare(b.player.name);
          return nameCompare !== 0 ? nameCompare : a.pickNumber - b.pickNumber;
        });
      case "POSITION":
        return list.sort((a, b) => {
          const positionCompare =
            (positionOrder[a.player.position as PlayerPosition] ?? 99) -
            (positionOrder[b.player.position as PlayerPosition] ?? 99);
          if (positionCompare !== 0) return positionCompare;
          const nameCompare = a.player.name.localeCompare(b.player.name);
          return nameCompare !== 0 ? nameCompare : a.pickNumber - b.pickNumber;
        });
      case "DRAFT":
      default:
        return list.sort((a, b) => a.pickNumber - b.pickNumber);
    }
  }, [picks, sortOption]);

  return (
    <SectionCard
      title="My team"
      actions={
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Sort
          <select
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className="rounded-full border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--text)]"
          >
            <option value="DRAFT">Draft order</option>
            <option value="NAME">Name</option>
            <option value="POSITION">Position</option>
          </select>
        </label>
      }
    >
      {sortedPicks.length ? (
        <ul className="flex flex-col gap-3">
          {sortedPicks.map((pick) => (
            <li key={pick.id} className="rounded-xl bg-white p-3">
              <p className="text-sm font-semibold text-zinc-900">
                {formatPlayerName(pick.player.name, pick.player.jerseyNumber)}
              </p>
              <p className="text-xs text-zinc-500">
                {pick.player.position} ·{" "}
                {pick.player.club
                  ? getClubDisplayName(
                      pick.player.club.slug,
                      pick.player.club.name,
                    )
                  : "—"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                Round {pick.round} · Pick {pick.pickNumber}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">No picks yet.</p>
      )}
    </SectionCard>
  );
}
