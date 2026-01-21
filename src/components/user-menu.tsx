"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserMenuProps = {
  isAuthenticated: boolean;
  displayName: string;
  avatarUrl: string | null;
  hasOwnedLeagues: boolean;
  isAdmin: boolean;
};

export default function UserMenu({
  isAuthenticated,
  displayName,
  avatarUrl,
  hasOwnedLeagues,
  isAdmin,
}: UserMenuProps) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (!isAuthenticated) {
    return (
      <Link
        href="/auth"
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--background)] transition hover:bg-[var(--accent-muted)]"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:border-[var(--accent)]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full border border-[var(--border)] object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border)] text-xs font-semibold text-[var(--text)]">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate sm:block">
          {displayName}
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-20 mt-3 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
          role="menu"
        >
          <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Signed in
          </div>
          <Link
            href="/account"
            className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)]"
            role="menuitem"
          >
            Account settings
          </Link>
          <Link
            href="/leagues"
            className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)]"
            role="menuitem"
          >
            My leagues
          </Link>
          {hasOwnedLeagues ? (
            <Link
              href="/settings/leagues"
              className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)]"
              role="menuitem"
            >
              League settings
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/admin"
              className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)]"
              role="menuitem"
            >
              Admin
            </Link>
          ) : null}
          <div className="my-2 h-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)]"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
