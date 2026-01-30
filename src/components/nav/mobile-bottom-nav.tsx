"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavState = {
  pendingTrades: number;
  pendingWaivers: number;
  showDraft: boolean;
  onClock: boolean;
};

const parseLeagueId = (pathname: string | null) => {
  if (!pathname) return null;
  const match = pathname.match(/^\/leagues\/([^/]+)/);
  return match?.[1] ?? null;
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const leagueId = parseLeagueId(pathname);
  const [navState, setNavState] = useState<NavState | null>(null);

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

  const tabs = useMemo(() => {
    if (!leagueId) return [] as Array<{ key: string; href: string; label: string; icon: string }>;
    const base = `/leagues/${leagueId}`;
    const items = [
      { key: "team", href: `${base}/team`, label: "My Team", icon: "🏟️" },
      { key: "league", href: base, label: "League", icon: "🏆" },
      { key: "players", href: `${base}/players`, label: "Players", icon: "🧩" },
    ];
    if (navState?.showDraft) {
      items.push({ key: "draft", href: `${base}/draft`, label: "Draft", icon: "⏱️" });
    }
    items.push({ key: "more", href: `${base}/more`, label: "More", icon: "⋯" });
    return items;
  }, [leagueId, navState?.showDraft]);

  if (!leagueId || tabs.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 sm:hidden">
      <div className="flex items-center justify-between">
        {tabs.map((tab) => {
          const isActive =
            tab.key === "league"
              ? pathname === tab.href
              : pathname?.startsWith(tab.href);
          const showBadge =
            tab.key === "more" &&
            ((navState?.pendingTrades ?? 0) > 0 ||
              (navState?.pendingWaivers ?? 0) > 0);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <div className="relative">
                <span className="text-base" aria-hidden>
                  {tab.icon}
                </span>
                {tab.key === "draft" && navState?.onClock ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                ) : null}
                {showBadge ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--danger)]" />
                ) : null}
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
