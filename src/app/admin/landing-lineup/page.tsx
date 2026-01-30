import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { getAdminConsoleData } from "@/app/admin/admin-data";
import {
  DEFAULT_LANDING_SLOT_ASSIGNMENTS,
  LANDING_LINEUP_SLOT_DEFS,
} from "@/lib/landing-lineup";
import {
  POSITION_KEYS,
  POSITION_LABELS,
  type PositionKey,
} from "@/lib/lineup-positions";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

const buildPlayerLabel = (player: {
  name: string;
  position: string;
  jerseyNumber: number | null;
  club: { shortName: string | null } | null;
}) => {
  const parts = [player.name];
  if (player.club?.shortName) {
    parts.push(player.club.shortName);
  }
  if (player.jerseyNumber != null) {
    parts.push(`#${player.jerseyNumber}`);
  }
  return parts.join(" - ");
};

async function saveLandingLineup(formData: FormData) {
  "use server";
  await requireAdminUser();

  const seasonId = formData.get("seasonId");
  if (typeof seasonId !== "string" || !seasonId) {
    return;
  }

  const slotData = LANDING_LINEUP_SLOT_DEFS.map((slot) => {
    const value = formData.get(slot.slotKey);
    const playerId = typeof value === "string" && value ? value : null;
    return {
      slotKey: slot.slotKey,
      group: slot.group,
      position: slot.position,
      order: slot.order,
      playerId,
    };
  });

  await prisma.$transaction(async (tx) => {
    const lineup = await tx.landingLineup.upsert({
      where: { seasonId },
      update: {},
      create: { seasonId },
    });

    await tx.landingLineupSlot.deleteMany({ where: { lineupId: lineup.id } });

    await tx.landingLineupSlot.createMany({
      data: slotData.map((slot) => ({
        lineupId: lineup.id,
        slotKey: slot.slotKey,
        group: slot.group,
        position: slot.position,
        order: slot.order,
        playerId: slot.playerId,
      })),
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/landing-lineup");
}

export default async function AdminLandingLineupPage() {
  const { season } = await getAdminConsoleData();

  if (!season) {
    return (
      <SectionCard
        title="Landing lineup"
        description="Create or activate a season before configuring the landing lineup."
      >
        <p className="text-sm text-[var(--text-muted)]">
          No active season found.
        </p>
      </SectionCard>
    );
  }

  const [players, lineup] = await Promise.all([
    prisma.player.findMany({
      where: { seasonId: season.id, active: true },
      select: {
        id: true,
        name: true,
        position: true,
        jerseyNumber: true,
        club: { select: { shortName: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.landingLineup.findUnique({
      where: { seasonId: season.id },
      include: { slots: true },
    }),
  ]);

  const playersByPosition = POSITION_KEYS.reduce(
    (acc, position) => {
      acc[position] = players.filter((player) => player.position === position);
      return acc;
    },
    {} as Record<PositionKey, typeof players>,
  );

  const assignments = new Map<string, string>();

  if (lineup?.slots.length) {
    lineup.slots.forEach((slot) => {
      if (slot.playerId) {
        assignments.set(slot.slotKey, slot.playerId);
      }
    });
  } else {
    const playerIdByName = new Map(
      players.map((player) => [player.name, player.id]),
    );
    Object.entries(DEFAULT_LANDING_SLOT_ASSIGNMENTS).forEach(([slotKey, name]) => {
      const playerId = playerIdByName.get(name);
      if (playerId) {
        assignments.set(slotKey, playerId);
      }
    });
  }

  const starterSlots = LANDING_LINEUP_SLOT_DEFS.filter(
    (slot) => slot.group === "STARTER",
  );
  const benchSlots = LANDING_LINEUP_SLOT_DEFS.filter(
    (slot) => slot.group === "BENCH",
  );
  const playerById = new Map(players.map((player) => [player.id, player]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Admin"
        title="Landing lineup"
        subtitle="Pick the starters and bench players shown on the marketing homepage."
      />

      <div className="sm:hidden">
        <SectionCard title="Current lineup (read-only)">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Starters
              </p>
              <div className="mt-3 space-y-3">
                {starterSlots.map((slot) => {
                  const playerId = assignments.get(slot.slotKey) ?? "";
                  const player = playerById.get(playerId);
                  return (
                    <div
                      key={slot.slotKey}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {slot.label}
                      </p>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {player ? buildPlayerLabel(player) : "Open slot"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Bench
              </p>
              <div className="mt-3 space-y-3">
                {benchSlots.map((slot) => {
                  const playerId = assignments.get(slot.slotKey) ?? "";
                  const player = playerById.get(playerId);
                  return (
                    <div
                      key={slot.slotKey}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {slot.label}
                      </p>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {player ? buildPlayerLabel(player) : "Open slot"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <form action={saveLandingLineup} className="hidden space-y-8 sm:block">
        <input type="hidden" name="seasonId" value={season.id} />

        <SectionCard
          title="Starting lineup"
          description="Starter slots only list players in the same position."
        >
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {POSITION_KEYS.map((position) => {
              const slotsForPosition = starterSlots.filter(
                (slot) => slot.position === position,
              );
              return (
                <div
                  key={position}
                  className="rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {POSITION_LABELS[position]}
                  </p>
                  <div className="mt-4 space-y-4">
                    {slotsForPosition.map((slot) => {
                      const selected = assignments.get(slot.slotKey) ?? "";
                      return (
                        <label key={slot.slotKey} className="block">
                          <span className="text-xs font-semibold text-zinc-600">
                            {slot.label}
                          </span>
                          <select
                            name={slot.slotKey}
                            defaultValue={selected}
                            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Open slot</option>
                            {playersByPosition[position].map((player) => (
                              <option key={player.id} value={player.id}>
                                {buildPlayerLabel(player)}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Bench"
          description="Bench slots can include any active player."
        >
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {benchSlots.map((slot) => {
              const selected = assignments.get(slot.slotKey) ?? "";
              return (
                <label key={slot.slotKey} className="block">
                  <span className="text-xs font-semibold text-zinc-600">
                    {slot.label}
                  </span>
                  <select
                    name={slot.slotKey}
                    defaultValue={selected}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Open slot</option>
                    {POSITION_KEYS.map((position) => (
                      <optgroup
                        key={`bench-${position}`}
                        label={POSITION_LABELS[position]}
                      >
                        {playersByPosition[position].map((player) => (
                          <option key={player.id} value={player.id}>
                            {buildPlayerLabel(player)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </SectionCard>

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Changes apply immediately to the landing page preview.
          </p>
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Save lineup
          </button>
        </div>
      </form>
    </div>
  );
}
