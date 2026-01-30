"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import UserMenu from "./user-menu";
import { useSheet } from "@/components/overlays/sheet-provider";

const NAV_ITEMS = [
  { label: "My Teams", href: "/my-teams", matchers: ["/my-teams"] },
  { label: "Leagues", href: "/leagues", matchers: ["/leagues"] },
  { label: "Stats", href: "/players", matchers: ["/players"] },
  { label: "Schedule", href: "/schedule", matchers: ["/schedule"] },
  { label: "Rules", href: "/rules", matchers: ["/rules"] },
] as const;

const padTwo = (value: number) => String(value).padStart(2, "0");

const formatCountdown = (ms: number) => {
  const safeMs = Math.max(0, Math.floor(ms));
  const days = Math.floor(safeMs / 86_400_000);
  const hours = Math.floor((safeMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  return `${days}d ${padTwo(hours)}h ${padTwo(minutes)}m`;
};

type NavState = {
  pendingTrades: number;
  pendingWaivers: number;
  showDraft: boolean;
  onClock: boolean;
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
  const sheet = useSheet();
  const [now, setNow] = useState(() => new Date());
  const [navState, setNavState] = useState<NavState | null>(null);

  const leagueId = useMemo(() => {
    const match = pathname.match(/^\/leagues\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!leagueId) {
      setNavState(null);
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/nav-state`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as NavState | null;
        if (!res.ok || !data) return;
        if (isMounted) setNavState(data);
      } catch {
        if (isMounted) setNavState(null);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [leagueId]);

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

  const mobileTitle = useMemo(() => {
    if (normalizedPath.startsWith("/leagues/")) {
      const suffix = normalizedPath.replace(/^\/leagues\/[^/]+/, "") || "/";
      if (suffix === "/" || suffix === "") return "League";
      if (suffix.startsWith("/team")) return "My Team";
      if (suffix.startsWith("/players")) return "Players";
      if (suffix.startsWith("/draft")) return "Draft";
      if (suffix.startsWith("/trades")) return "Trades";
      if (suffix.startsWith("/settings")) return "League Settings";
      if (suffix.startsWith("/rules")) return "Rules";
      if (suffix.startsWith("/schedule")) return "Schedule";
      if (suffix.startsWith("/stats")) return "Stats";
      if (suffix.startsWith("/more")) return "More";
      return "League";
    }
    if (normalizedPath.startsWith("/my-teams")) return "My Teams";
    if (normalizedPath.startsWith("/leagues")) return "Leagues";
    if (normalizedPath.startsWith("/players")) return "Stats";
    if (normalizedPath.startsWith("/schedule")) return "Schedule";
    if (normalizedPath.startsWith("/rules")) return "Rules";
    if (normalizedPath.startsWith("/admin")) return "Admin";
    if (normalizedPath.startsWith("/feedback")) return "Feedback";
    if (normalizedPath.startsWith("/privacy")) return "Privacy";
    if (normalizedPath.startsWith("/matches")) return "Match";
    return "Fantasy CPL";
  }, [normalizedPath]);

  const mobileMenuItems = useMemo(() => {
    const items: Array<{
      label: string;
      href: string;
      showBadge?: boolean;
    }> = [];

    if (leagueId) {
      const base = `/leagues/${leagueId}`;
      items.push({
        label: "Trades",
        href: `${base}/trades`,
        showBadge: (navState?.pendingTrades ?? 0) > 0,
      });
      items.push({ label: "Schedule", href: `${base}/schedule` });
      items.push({ label: "Stats", href: `${base}/stats` });
      items.push({ label: "Rules", href: `${base}/rules` });
      items.push({ label: "Feedback", href: "/feedback" });
      items.push({ label: "Privacy", href: "/privacy" });
      if (hasOwnedLeagues || isAdmin) {
        items.push({ label: "League Settings", href: `${base}/settings` });
      }
      if (isAdmin) {
        items.push({ label: "Admin", href: "/admin" });
      }
      return items;
    }

    items.push({ label: "Schedule", href: "/schedule" });
    items.push({ label: "Stats", href: "/players" });
    items.push({ label: "Rules", href: "/rules" });
    items.push({ label: "Feedback", href: "/feedback" });
    items.push({ label: "Privacy", href: "/privacy" });
    if (isAdmin) {
      items.push({ label: "Admin", href: "/admin" });
    }
    return items;
  }, [leagueId, navState?.pendingTrades, hasOwnedLeagues, isAdmin]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1300px] items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href={isAuthenticated ? "/my-teams" : "/"}
            className="hidden items-center gap-2 sm:flex"
            aria-label="Fantasy CPL home"
          >
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
          <button
            type="button"
            onClick={() => {
              void sheet.open({
                id: "mobile-nav",
                title: "Menu",
                subtitle: "League shortcuts and account links.",
                size: "sm",
                render: (ctx) => (
                  <div className="flex flex-col gap-2">
                    {mobileMenuItems.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text-muted)]">
                        No menu items available.
                      </div>
                    ) : (
                      mobileMenuItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => ctx.close({ type: "dismiss" })}
                          className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
                        >
                          <span className="flex items-center gap-2">
                            {item.label}
                            {item.showBadge ? (
                              <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                            ) : null}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            →
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                ),
              });
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface2)] text-lg text-[var(--text)] sm:hidden"
            aria-label="Open navigation menu"
          >
            ☰
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center sm:hidden">
          <span className="text-sm font-semibold text-[var(--text)]">
            {mobileTitle}
          </span>
        </div>

        <nav className="hidden flex-1 flex-wrap items-center justify-center gap-3 overflow-x-auto px-2 text-sm font-semibold text-[var(--text-muted)] sm:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = item.matchers.some(
              (matcher) =>
                normalizedPath === matcher ||
                normalizedPath.startsWith(`${matcher}/`),
            );
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] ${
                  isActive
                    ? "text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-xs font-semibold text-[var(--text)] sm:flex">
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
