"use client";

import { useState } from "react";
import RosterClient from "./roster-client";
import ScoringCard from "./scoring-card";
import { useSheet } from "@/components/overlays/sheet-provider";

type Slot = {
  id: string;
  slotNumber: number;
  position: string;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: string;
    club: { shortName: string | null; slug: string; name: string } | null;
  } | null;
};

type Props = {
  leagueId: string;
  matchWeekNumber: number;
  slots: Slot[];
  isLocked: boolean;
};

export default function TeamMobileTabs({
  leagueId,
  matchWeekNumber,
  slots,
  isLocked,
}: Props) {
  const [tab, setTab] = useState<"lineup" | "scoring">("lineup");
  const sheet = useSheet();

  return (
    <div className="sm:hidden">
      <div className="flex w-full rounded-full border border-[var(--border)] bg-[var(--surface2)] p-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {[
          { key: "lineup", label: "Lineup" },
          { key: "scoring", label: "Scoring" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as "lineup" | "scoring")}
            className={`flex-1 rounded-full px-3 py-2 text-[11px] ${
              tab === item.key
                ? "bg-[var(--surface)] text-[var(--text)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "lineup" ? (
        <RosterClient
          leagueId={leagueId}
          initialSlots={slots}
          matchWeekNumber={matchWeekNumber}
          isLocked={isLocked}
        />
      ) : null}

      {tab === "scoring" ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Auto-sub indicator
              </p>
              <p className="text-sm text-[var(--text)]">
                Auto-subs apply if a starter doesn’t play.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                sheet.open({
                  id: "auto-sub-info",
                  title: "Auto-sub rules",
                  render: () => (
                    <p className="text-sm text-[var(--text-muted)]">
                      If a starter records 0 minutes, the next eligible bench
                      player will auto-sub in based on position rules.
                    </p>
                  ),
                })
              }
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              Details
            </button>
          </div>
          <ScoringCard leagueId={leagueId} matchWeekNumber={matchWeekNumber} />
        </div>
      ) : null}
    </div>
  );
}
