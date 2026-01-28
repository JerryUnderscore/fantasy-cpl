"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import PageHeader from "@/components/layout/page-header";

type RulesSection = {
  id: string;
  title: string;
  content: ReactNode;
};

const anchorIds = [
  "overview",
  "leagues-and-teams",
  "rosters",
  "draft",
  "lineups-and-matchweeks",
  "scoring",
  "matchups-and-standings",
  "stats-and-beta",
  "sportsmanship",
] as const;

const normalizeHash = (hash: string) => hash.replace(/^#/, "");

export default function RulesPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(),
  );

  const sections = useMemo<RulesSection[]>(
    () => [
      {
        id: "overview",
        title: "Overview",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <p>
              The Fantasy CPL beta follows a single, universal ruleset. Every
              league plays by the same constitution, and this page is the
              canonical handbook for all players.
            </p>
            <p>
              League settings (draft type, scoring format, league size) are
              chosen by commissioners, but gameplay rules are shared across the
              platform.
            </p>
          </div>
        ),
      },
      {
        id: "leagues-and-teams",
        title: "Leagues & teams",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>Each league is private and created by a commissioner.</li>
              <li>Leagues may have 6–10 teams.</li>
              <li>All leagues use the same rules and scoring system.</li>
              <li>Each league operates independently (no cross-league play).</li>
            </ul>
          </div>
        ),
      },
      {
        id: "rosters",
        title: "Rosters",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <p>
              Each fantasy team has a fixed roster size and position structure.
            </p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Roster composition
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Goalkeepers (GK)</li>
                <li>Defenders (DEF)</li>
                <li>Midfielders (MID)</li>
                <li>Forwards (FWD)</li>
              </ul>
            </div>
            <p>
              Roster limits are fixed for all leagues and cannot be customized
              during the beta.
            </p>
          </div>
        ),
      },
      {
        id: "draft",
        title: "Draft",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>All leagues use a snake draft.</li>
              <li>Draft order is randomized.</li>
              <li>Draft timer is enforced; missed picks auto-select.</li>
              <li>
                Players may be drafted from the full pool of active CPL players.
              </li>
            </ul>
            <p>
              There is no salary cap and no player pricing during the beta
              season.
            </p>
          </div>
        ),
      },
      {
        id: "lineups-and-matchweeks",
        title: "Lineups & matchweeks",
        content: (
          <div className="space-y-4 text-sm text-[var(--text-muted)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Weekly lock
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Lineups are set weekly.</li>
                <li>Lineups lock at the first kickoff of the matchweek.</li>
                <li>Once locked, lineups cannot be changed.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Starting lineup rules
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  A starting lineup must include the required number of outfield
                  players.
                </li>
                <li>Goalkeeper is optional.</li>
                <li>If you start a goalkeeper, they score points normally.</li>
                <li>
                  If you do not start a goalkeeper, you simply do not receive
                  goalkeeper points.
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Bench rules
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  Bench players do not score points unless used for an automatic
                  substitution.
                </li>
                <li>
                  If a starter does not play at all, the highest-priority
                  eligible bench player will be substituted in automatically.
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: "scoring",
        title: "Scoring",
        content: (
          <div className="space-y-4 text-sm text-[var(--text-muted)]">
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface2)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text)]">
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Appearance</td>
                    <td className="px-4 py-3 font-semibold">+1</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">
                      Goal (GK / DEF)
                    </td>
                    <td className="px-4 py-3 font-semibold">+5</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Goal (MID)</td>
                    <td className="px-4 py-3 font-semibold">+4</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Goal (FWD)</td>
                    <td className="px-4 py-3 font-semibold">+3</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Assist</td>
                    <td className="px-4 py-3 font-semibold">+3</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">
                      Clean sheet (GK / DEF, 60+ minutes)
                    </td>
                    <td className="px-4 py-3 font-semibold">+4</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Yellow card</td>
                    <td className="px-4 py-3 font-semibold">−1</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-4 py-3">Red card</td>
                    <td className="px-4 py-3 font-semibold">−3</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Own goal</td>
                    <td className="px-4 py-3 font-semibold">−2</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              No hidden mechanics. No bonus points. No advanced metrics or
              subjective awards.
            </p>
          </div>
        ),
      },
      {
        id: "matchups-and-standings",
        title: "Matchups & standings",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Leagues may use head-to-head matchups or total points standings
                (league default).
              </li>
              <li>Weekly points determine matchup results.</li>
              <li>Standings update after each matchweek is finalized.</li>
            </ul>
          </div>
        ),
      },
      {
        id: "stats-and-beta",
        title: "Stats & beta status",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>Match statistics are entered manually during the beta.</li>
              <li>Updates may occur after the final match of the matchweek.</li>
              <li>Scores are considered provisional until finalized.</li>
            </ul>
            <p>Because this is a beta:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Corrections may occur.</li>
              <li>Delays may happen.</li>
              <li>Edge cases will exist.</li>
            </ul>
          </div>
        ),
      },
      {
        id: "sportsmanship",
        title: "Sportsmanship & fair use",
        content: (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                League names, team names, and user content must remain
                reasonable.
              </li>
              <li>
                Commissioners may remove teams for disruptive or abusive
                behavior.
              </li>
              <li>
                Exploits, automation, or intentional abuse of the system may
                result in removal.
              </li>
            </ul>
            <p className="text-[var(--text-muted)]">
              Basically: don&apos;t be weird.
            </p>
          </div>
        ),
      },
    ],
    [],
  );

  const openSection = useCallback((id: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const setHash = useCallback(
    (id: string, shouldScroll = true) => {
      if (!anchorIds.includes(id as (typeof anchorIds)[number])) return;
      if (window.location.hash !== `#${id}`) {
        window.history.replaceState(null, "", `#${id}`);
      }
      if (shouldScroll) {
        scrollToSection(id);
      }
    },
    [scrollToSection],
  );

  const setHashAndOpen = useCallback(
    (id: string) => {
      openSection(id);
      setHash(id, true);
    },
    [openSection, setHash],
  );

  useEffect(() => {
    const handleHash = () => {
      const hash = normalizeHash(window.location.hash);
      if (!hash) return;
      if (!anchorIds.includes(hash as (typeof anchorIds)[number])) return;
      openSection(hash);
      scrollToSection(hash);
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [openSection, scrollToSection]);

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_25px_45px_rgba(1,2,12,0.55)]">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] hover:underline"
          >
            ← Back to dashboard
          </Link>
          <PageHeader
            title="Rules & Guidelines"
            subtitle="The Fantasy CPL beta follows a unified rule set for every league."
          />
        </div>

        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Table of contents
          </h2>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  setHashAndOpen(section.id);
                }}
                className="text-[var(--text)] underline-offset-4 transition hover:text-[var(--accent)] hover:underline"
              >
                {section.title}
              </a>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-4">
          {sections.map((section) => {
            const isOpen = openSections.has(section.id);
            return (
              <div
                key={section.id}
                id={section.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)]"
              >
                <div className="flex items-center justify-between gap-4 p-5">
                  <button
                    type="button"
                    onClick={() => {
                      toggleSection(section.id);
                      setHash(section.id, true);
                    }}
                    className="flex flex-1 items-center justify-between gap-3 text-left text-base font-semibold text-[var(--text)]"
                    aria-expanded={isOpen}
                    aria-controls={`${section.id}-content`}
                  >
                    <span>{section.title}</span>
                    <span
                      className={`text-xs uppercase tracking-wide ${
                        isOpen ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHashAndOpen(section.id)}
                    aria-label={`Link to ${section.title}`}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    🔗
                  </button>
                </div>
                {isOpen ? (
                  <div
                    id={`${section.id}-content`}
                    className="border-t border-[var(--border)] p-5"
                  >
                    {section.content}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
