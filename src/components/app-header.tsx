"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import UserMenu from "./user-menu";

const NAV_ITEMS = [
  { label: "My Teams", href: "/my-teams" },
  { label: "Leagues", href: "/leagues" },
  { label: "Stats", href: "/players" },
  { label: "Schedule", href: "/schedule" },
  { label: "Rules", href: "/rules" },
] as const;

const padTwo = (value: number) => String(value).padStart(2, "0");

const formatCountdown = (ms: number) => {
  const safeMs = Math.max(0, Math.floor(ms));
  const days = Math.floor(safeMs / 86_400_000);
  const hours = Math.floor((safeMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  return `${days}:${padTwo(hours)}:${padTwo(minutes)}`;
};

type AppHeaderProps = {
  isAuthenticated: boolean;
  displayName: string;
  avatarUrl: string | null;
  hasOwnedLeagues: boolean;
  isAdmin: boolean;
  lineupLockAt: string | null;
  nextMatchweekStartsAt: string | null;
  currentMatchWeekStatus: string | null;
};

export default function AppHeader({
  isAuthenticated,
  displayName,
  avatarUrl,
  hasOwnedLeagues,
  isAdmin,
  lineupLockAt,
  nextMatchweekStartsAt,
  currentMatchWeekStatus,
}: AppHeaderProps) {
  const pathname = usePathname() ?? "/";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const lineupLockDate = useMemo(
    () => (lineupLockAt ? new Date(lineupLockAt) : null),
    [lineupLockAt],
  );
  const nextMatchweekDate = useMemo(
    () => (nextMatchweekStartsAt ? new Date(nextMatchweekStartsAt) : null),
    [nextMatchweekStartsAt],
  );

  const statusLocked =
    currentMatchWeekStatus === "LOCKED" ||
    currentMatchWeekStatus === "FINALIZED";
  const locked =
    statusLocked ||
    (lineupLockDate ? now.getTime() >= lineupLockDate.getTime() : false);

  const targetDate = locked ? nextMatchweekDate : lineupLockDate;
  const countdownLabel = locked
    ? "Lineups locked. Next matchweek starts in"
    : "Lineups lock in";
  const countdownValue = formatCountdown(
    targetDate ? targetDate.getTime() - now.getTime() : 0,
  );

  const normalizedPath = pathname.split("?")[0];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1300px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2" aria-label="Fantasy CPL home">
              <Image
                src="/brand/fantasy-cpl-logo.png"
                alt="Fantasy CPL logo"
                width={128}
                height={32}
                className="h-10 w-auto object-contain"
                priority
              />
              <span className="sr-only">Fantasy CPL</span>
            </Link>
          </div>

          <nav className="flex flex-1 flex-wrap items-center justify-center gap-3 overflow-x-auto px-2 text-sm font-semibold text-[var(--text-muted)]">
            {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? normalizedPath === "/"
                : normalizedPath === item.href ||
                  normalizedPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 transition ${
                  isActive
                    ? "border border-[var(--accent)] bg-[var(--surface2)] text-[var(--accent)]"
                    : "border border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
            <span className="text-[var(--text)] text-xs font-semibold">
              {countdownLabel}
            </span>
            <span className="text-[var(--accent)] text-sm font-semibold">
              {countdownValue}
            </span>
          </div>
          <UserMenu
            isAuthenticated={isAuthenticated}
            displayName={displayName}
            avatarUrl={avatarUrl}
            hasOwnedLeagues={hasOwnedLeagues}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}
