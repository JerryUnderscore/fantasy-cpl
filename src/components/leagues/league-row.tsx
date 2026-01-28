"use client";

import Link from "next/link";
import type { MyLeagueViewModel } from "./types";
import { clickableSurface } from "@/components/layout/ui-interactions";

type LeagueRowProps = {
  data: MyLeagueViewModel;
};

export default function LeagueRow({ data }: LeagueRowProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-5 py-4 shadow-sm ${clickableSurface}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{data.league.name}</p>
          <p className="text-sm text-[var(--text-muted)]">
            {data.teamName ? `Your team: ${data.teamName}` : "No team yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
          <Link
            href={`/leagues/${data.league.id}`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--text)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            View league
          </Link>
          {data.isOwner ? (
            <Link
              href={`/leagues/${data.league.id}/settings`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Settings
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
          {data.role}
        </span>
        <span className="text-sm text-[var(--text-muted)]">{data.statusText}</span>
        {data.standings ? (
          <span className="ml-auto text-sm font-semibold text-[var(--accent)]">
            #{data.standings.rank} of {data.standings.totalTeams}
          </span>
        ) : null}
      </div>
    </div>
  );
}
