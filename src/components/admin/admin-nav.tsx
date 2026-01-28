"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/matchweeks", label: "Matchweeks" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/landing-lineup", label: "Landing Lineup" },
  { href: "/admin/schedule", label: "Schedule" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-[var(--surface2)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
