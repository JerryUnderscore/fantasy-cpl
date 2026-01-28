import Image from "next/image";
import Link from "next/link";
import LandingLineup, { type StaticSlot } from "@/components/landing-lineup";
import type { PositionKey } from "@/lib/lineup-positions";
import { prisma } from "@/lib/prisma";
import { getActiveSeason } from "@/lib/matchweek";
import {
  DEFAULT_LANDING_BENCH,
  DEFAULT_LANDING_PLAYER_NAMES,
  DEFAULT_LANDING_STARTERS,
} from "@/lib/landing-lineup";

const FEATURE_CALLOUTS = [
  { icon: "/icons/soccer-ball.png", text: "Draft your team from CPL players." },
  { icon: "/icons/clipboard.svg", text: "Set a weekly lineup—no salary cap." },
  { icon: "/icons/monitor.png", text: "Score points from real matches." },
];

const WHY_REASONS = [
  "Built for Canadian Premier League fans.",
  "Private leagues only. No global leaderboards.",
  "Beta season. Community first.",
];

type PlayerLookup = {
  name: string;
  position: string;
  clubName: string | null;
  clubSlug: string | null;
  jerseyNumber: number | null;
};

export default async function Home() {
  const season = await getActiveSeason();
  const lineup = season
    ? await prisma.landingLineup.findUnique({
        where: { seasonId: season.id },
        include: {
          slots: {
            include: {
              player: {
                select: {
                  name: true,
                  position: true,
                  jerseyNumber: true,
                  club: { select: { shortName: true, slug: true } },
                },
              },
            },
          },
        },
      })
    : null;

  const hasCustomLineup = (lineup?.slots.length ?? 0) > 0;

  let startersByPosition: Record<PositionKey, StaticSlot[]> = {
    FWD: [],
    MID: [],
    DEF: [],
    GK: [],
  };
  let benchSlots: StaticSlot[] = [];

  if (hasCustomLineup && lineup) {
    const buildSlotFromLineup = (slot: {
      slotKey: string;
      position: PositionKey | null;
      player: {
        name: string;
        position: string;
        jerseyNumber: number | null;
        club: { shortName: string | null; slug: string | null } | null;
      } | null;
    }): StaticSlot => {
      const player = slot.player;
      return {
        id: slot.slotKey,
        name: player?.name ?? "Open slot",
        clubName: player?.club?.shortName ?? null,
        clubSlug: player?.club?.slug ?? null,
        position: player?.position ?? slot.position ?? "Player",
        jerseyNumber: player?.jerseyNumber ?? null,
      };
    };

    const starterSlots = lineup.slots
      .filter((slot) => slot.group === "STARTER" && slot.position)
      .sort((a, b) => a.order - b.order);

    for (const slot of starterSlots) {
      const position = slot.position as PositionKey;
      startersByPosition[position] = [
        ...(startersByPosition[position] ?? []),
        buildSlotFromLineup(slot),
      ];
    }

    benchSlots = lineup.slots
      .filter((slot) => slot.group === "BENCH")
      .sort((a, b) => a.order - b.order)
      .map(buildSlotFromLineup);
  } else {
    const players = season
      ? await prisma.player.findMany({
          where: {
            seasonId: season.id,
            name: { in: DEFAULT_LANDING_PLAYER_NAMES },
          },
          select: {
            name: true,
            position: true,
            jerseyNumber: true,
            club: { select: { shortName: true, slug: true } },
          },
        })
      : [];

    const lookup = new Map<string, PlayerLookup>();

    // Default entries so the pitch still renders even if a lookup fails.
    for (const name of DEFAULT_LANDING_PLAYER_NAMES) {
      lookup.set(name, {
        name,
        position: "Player",
        clubName: null,
        clubSlug: null,
        jerseyNumber: null,
      });
    }

    for (const player of players) {
      lookup.set(player.name, {
        name: player.name,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        clubName: player.club?.shortName ?? null,
        clubSlug: player.club?.slug ?? null,
      });
    }

    const buildSlot = (name: string): StaticSlot => {
      const player = lookup.get(name);
      return {
        id: name,
        name,
        clubName: player?.clubName ?? null,
        clubSlug: player?.clubSlug ?? null,
        position: player?.position ?? "Player",
        jerseyNumber: player?.jerseyNumber ?? null,
      };
    };

    for (const group of DEFAULT_LANDING_STARTERS) {
      startersByPosition[group.key] = group.players.map(buildSlot);
    }

    benchSlots = DEFAULT_LANDING_BENCH.map(buildSlot);
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c0f14] via-[#11141d] to-[#081019] px-8 py-12 text-center shadow-[0_25px_80px_rgba(4,5,9,0.9)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.06), transparent 55%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12), transparent)",
          }}
        />
        <div className="relative space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight text-white">
            Fantasy Canadian Premier League.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Simple rules. Draft-based. Built for real fans.
          </p>
          <p className="mx-auto max-w-2xl text-base text-white/70">
            Draft players from the Canadian Premier League, manage your starting
            eleven, and compete with friends in a lightweight fantasy experience
            that respects supporters first.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              href="/leagues"
              className="rounded-full bg-[#fbc634] px-6 py-3 text-base font-semibold transition hover:bg-[#ffd860]"
              style={{ color: "#101014" }}
            >
              Create a League
            </Link>
            <Link
              href="/leagues"
              className="rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition hover:border-white/70"
            >
              Join a League
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-8 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Line selection
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">
            Sample starting eleven
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            This is a static lineup preview inspired by the pitch view in your
            team settings.
          </p>
        </div>

        <div className="mt-6">
          <LandingLineup
            startersByPosition={startersByPosition}
            bench={benchSlots}
            benchDescription="Bench spots stay flexible until your league locks lineups."
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-8 shadow-sm">
        <div className="grid gap-6 border-b border-white/10 pb-6 sm:grid-cols-3">
          {FEATURE_CALLOUTS.map((feature) => (
            <div
              key={feature.text}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5 p-3">
                <Image
                  src={feature.icon}
                  alt={feature.text}
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <p className="text-sm font-semibold text-white">{feature.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <h3 className="text-xl font-semibold text-white">Why this exists</h3>
          <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
            {WHY_REASONS.map((reason) => (
              <li
                key={reason}
                className="flex items-start justify-center gap-2"
              >
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#c7a55b]" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
