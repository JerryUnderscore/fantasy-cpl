"use client";

import { useRouter, useSearchParams } from "next/navigation";

type MatchWeekOption = {
  id: string;
  number: number;
  status: string;
};

type Props = {
  matchWeeks: MatchWeekOption[];
  selectedNumber: number;
  activeNumber?: number | null;
};

export default function MatchWeekSelector({
  matchWeeks,
  selectedNumber,
  activeNumber,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("matchWeek", value);
    router.replace(`?${next.toString()}`);
  };

  if (!matchWeeks.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        MatchWeek
      </p>
      <select
        value={String(selectedNumber)}
        onChange={(event) => handleChange(event.target.value)}
        className="min-w-[180px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
      >
        {matchWeeks.map((matchWeek) => (
          <option key={matchWeek.id} value={matchWeek.number}>
            MatchWeek {matchWeek.number} · {matchWeek.status}
            {matchWeek.number === activeNumber ? " · Active" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
