"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

export type TeamSwitcherOption = {
  id: string;
  label: string;
};

type TeamSwitcherProps = {
  selectedId: string;
  options: TeamSwitcherOption[];
};

export default function TeamSwitcher({ options, selectedId }: TeamSwitcherProps) {
  const router = useRouter();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    router.push(`/my-teams?teamId=${encodeURIComponent(value)}`);
  };

  return (
    <label className="flex flex-col text-xs uppercase tracking-wide text-[var(--text-muted)]">
      <span className="text-[var(--text)]">Team</span>
      <select
        value={selectedId}
        onChange={handleChange}
        className="mt-1 h-10 min-w-[220px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] shadow-sm focus:border-[var(--accent)] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-[var(--surface2)]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
