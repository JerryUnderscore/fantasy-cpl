import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import PlayersTableClient from "./players-table-client";
import { getClubDisplayName } from "@/lib/clubs";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

const positions = ["GK", "DEF", "MID", "FWD"] as const;

type Position = (typeof positions)[number];

const normalizePosition = (raw: string): Position | null => {
  const value = raw.trim().toUpperCase();
  if (!value) return null;

  if (["GK", "GOALKEEPER", "G"].includes(value)) return "GK";
  if (["DEF", "DEFENDER", "DF", "D"].includes(value)) return "DEF";
  if (["MID", "MIDFIELDER", "MF", "M"].includes(value)) return "MID";
  if (["FWD", "FORWARD", "FW", "F"].includes(value)) return "FWD";

  return null;
};

const normalizeLabel = (value: string) => {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parseCsv = (input: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  const text = input.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"") {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === "\"") {
        currentField += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === "," || char === "\n" || char === "\r")) {
      currentRow.push(currentField.trim());
      currentField = "";
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      if (char === ",") {
        continue;
      }
      rows.push(currentRow);
      currentRow = [];
      continue;
    }
    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value !== ""));
};

async function createPlayer(formData: FormData) {
  "use server";
  await requireAdminUser();

  const name = formData.get("name");
  const position = formData.get("position");
  const clubId = formData.get("clubId");
  const seasonId = formData.get("seasonId");
  const jerseyNumber = formData.get("jerseyNumber");

  if (
    typeof name !== "string" ||
    typeof position !== "string" ||
    typeof clubId !== "string" ||
    typeof seasonId !== "string" ||
    !name.trim()
  ) {
    return;
  }

  const parsedJersey =
    typeof jerseyNumber === "string" && jerseyNumber.trim() !== ""
      ? Number(jerseyNumber)
      : null;

  await prisma.player.create({
    data: {
      name: name.trim(),
      position,
      clubId,
      seasonId,
      active: true,
      jerseyNumber:
        parsedJersey !== null && Number.isFinite(parsedJersey)
          ? Math.floor(parsedJersey)
          : null,
    },
  });

  revalidatePath("/admin/players");
}

async function updatePlayer(formData: FormData) {
  "use server";
  await requireAdminUser();

  const playerId = formData.get("playerId");
  const position = formData.get("position");
  const clubId = formData.get("clubId");
  const jerseyNumber = formData.get("jerseyNumber");

  if (
    typeof playerId !== "string" ||
    typeof position !== "string" ||
    typeof clubId !== "string"
  ) {
    return;
  }

  const parsedJersey =
    typeof jerseyNumber === "string" && jerseyNumber.trim() !== ""
      ? Number(jerseyNumber)
      : null;

  await prisma.player.update({
    where: { id: playerId },
    data: {
      position,
      clubId,
      jerseyNumber:
        parsedJersey !== null && Number.isFinite(parsedJersey)
          ? Math.floor(parsedJersey)
          : null,
    },
  });

  revalidatePath("/admin/players");
}

async function togglePlayerActive(formData: FormData) {
  "use server";
  await requireAdminUser();

  const playerId = formData.get("playerId");
  const nextActive = formData.get("nextActive");

  if (typeof playerId !== "string" || typeof nextActive !== "string") {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: playerId },
      data: { active: nextActive === "true" },
    });

    if (nextActive === "false") {
      await tx.rosterSlot.updateMany({
        where: { playerId },
        data: { playerId: null, isStarter: false },
      });
      await tx.leaguePlayerWaiver.deleteMany({
        where: { playerId },
      });
      await tx.leagueWaiverClaim.deleteMany({
        where: { playerId, status: "PENDING" },
      });
    }
  });

  revalidatePath("/admin/players");
}

async function importPlayersCsv(formData: FormData) {
  "use server";
  await requireAdminUser();

  const file = formData.get("csvFile");
  const seasonId = formData.get("seasonId");

  if (!(file instanceof File)) {
    throw new Error(
      "CSV upload missing: form did not send a File (check encType).",
    );
  }
  if (typeof seasonId !== "string" || !seasonId) {
    throw new Error("Missing seasonId");
  }

  const csv = await file.text();
  const rows = parseCsv(csv);

  console.log("Parsed CSV rows:", rows.length);

  if (rows.length < 2) {
    return;
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const nameIndex = headerIndex.get("name");
  const positionIndex = headerIndex.get("position");
  const clubIndex =
    headerIndex.get("club") ??
    headerIndex.get("clubname") ??
    headerIndex.get("clubshortname");
  const jerseyIndex =
    headerIndex.get("jerseynumber") ?? headerIndex.get("jersey");

  if (
    nameIndex === undefined ||
    positionIndex === undefined ||
    clubIndex === undefined
  ) {
    return;
  }

  const clubs = await prisma.club.findMany({
    select: { id: true, name: true, shortName: true, slug: true },
  });
  const clubMap = new Map<string, string>();
  clubs.forEach((club) => {
    const labels = [club.name, club.shortName, club.slug].filter(
      (value): value is string => Boolean(value),
    );
    labels.forEach((label) => {
      const normalized = normalizeLabel(label);
      if (normalized) {
        clubMap.set(normalized, club.id);
      }
    });
  });

  let accepted = 0;
  let skippedMissing = 0;
  let skippedBadPos = 0;
  let skippedBadClub = 0;
  const unknownClubs = new Map<string, number>();
  const unknownPositions = new Map<string, number>();

  const operations: Array<ReturnType<typeof prisma.player.upsert>> = [];
  const createRows: Array<{
    id: string;
    name: string;
    seasonId: string;
    clubId: string;
    position: Position;
    jerseyNumber: number | null;
    active: true;
  }> = [];

  for (const row of rows.slice(1)) {
    const name = row[nameIndex]?.trim() ?? "";
    if (!name) {
      skippedMissing += 1;
      continue;
    }

    const positionRaw = row[positionIndex] ?? "";
    const positionNorm = normalizePosition(positionRaw);
    if (!positionNorm) {
      skippedBadPos += 1;
      const key = positionRaw.trim().toUpperCase() || "(empty)";
      unknownPositions.set(key, (unknownPositions.get(key) ?? 0) + 1);
      continue;
    }

    const clubLabelRaw = row[clubIndex] ?? "";
    const clubLabelNorm = normalizeLabel(clubLabelRaw);
    if (!clubLabelNorm) {
      skippedMissing += 1;
      continue;
    }

    const clubId = clubMap.get(clubLabelNorm);
    if (!clubId) {
      skippedBadClub += 1;
      unknownClubs.set(
        clubLabelNorm,
        (unknownClubs.get(clubLabelNorm) ?? 0) + 1,
      );
      continue;
    }

    const jerseyValue = jerseyIndex !== undefined ? row[jerseyIndex] : null;
    const jerseyParsed =
      typeof jerseyValue === "string" && jerseyValue.trim() !== ""
        ? Number(jerseyValue)
        : null;
    const jerseyNumber =
      jerseyParsed !== null && Number.isFinite(jerseyParsed)
        ? Math.floor(jerseyParsed)
        : null;

    operations.push(
      prisma.player.upsert({
        where: {
          seasonId_name: { seasonId, name },
        },
        update: {
          position: positionNorm,
          clubId,
          jerseyNumber,
          active: true,
        },
        create: {
          name,
          seasonId,
          clubId,
          position: positionNorm,
          jerseyNumber,
          active: true,
        },
      }),
    );

    createRows.push({
      id: crypto.randomUUID(),
      name,
      seasonId,
      clubId,
      position: positionNorm,
      jerseyNumber,
      active: true,
    });
    accepted += 1;
  }

  console.log("Import summary:", {
    total: rows.length - 1,
    accepted,
    skippedMissing,
    skippedBadPos,
    skippedBadClub,
  });

  const topUnknownPositions = Array.from(unknownPositions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topUnknownClubs = Array.from(unknownClubs.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topUnknownPositions.length > 0) {
    console.log("Top unknown positions:", topUnknownPositions);
  }
  if (topUnknownClubs.length > 0) {
    console.log("Top unknown clubs:", topUnknownClubs);
  }

  if (operations.length === 0) {
    return;
  }

  try {
    await prisma.$transaction(operations);
  } catch (error) {
    console.error("Player upsert transaction failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback =
      message.includes("seasonId_name") ||
      message.includes("Unique constraint") ||
      message.includes("unique constraint") ||
      message.includes("Invalid `prisma.player.upsert`");

    if (!shouldFallback) {
      throw error;
    }

    try {
      const result = await prisma.player.createMany({
        data: createRows,
        skipDuplicates: true,
      });
      console.log("Fallback createMany result:", result);
      console.log("Fallback update pass skipped: no unique constraint for upsert.");
    } catch (createError) {
      console.error("Fallback createMany failed:", createError);
      throw createError;
    }
  }

  revalidatePath("/admin/players");
}

export default async function AdminPlayersPage() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { year: "desc" },
  });

  const seasons = await prisma.season.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true, isActive: true },
  });

  const clubs = await prisma.club.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, slug: true },
  });

  const players = season
    ? await prisma.player.findMany({
        where: { seasonId: season.id },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          active: true,
          clubId: true,
          jerseyNumber: true,
          club: { select: { name: true, shortName: true, slug: true } },
        },
      })
    : [];

  if (!season) {
    return (
      <SectionCard
        title="Players"
        description="Create or activate a season before editing players."
      >
        <p className="text-sm text-[var(--text-muted)]">
          No active season found.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Admin"
        title="Players"
        subtitle={`Manage the CPL player pool · ${season.name} ${season.year}`}
      />

      <SectionCard title="Add player">
        <form action={createPlayer} className="grid gap-3 sm:grid-cols-4">
          <input
            type="text"
            name="name"
            placeholder="Player name"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            required
          />
          <input
            type="number"
            name="jerseyNumber"
            placeholder="Jersey #"
            min="0"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          <select
            name="position"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
          <select
            name="clubId"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {getClubDisplayName(club.slug, club.name)}
              </option>
            ))}
          </select>
          <select
            name="seasonId"
            defaultValue={season.id}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {seasons.map((seasonOption) => (
              <option key={seasonOption.id} value={seasonOption.id}>
                {seasonOption.year} - {seasonOption.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="sm:col-span-4 rounded-full bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            Add player
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Import players"
        description="CSV columns: name, position, club (shortName or name), jerseyNumber."
      >
        <form
          action={importPlayersCsv}
          className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]"
        >
          <input
            type="file"
            name="csvFile"
            accept=".csv,text/csv"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            required
          />
          <select
            name="seasonId"
            defaultValue={season.id}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {seasons.map((seasonOption) => (
              <option key={seasonOption.id} value={seasonOption.id}>
                {seasonOption.year} - {seasonOption.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            Upload CSV
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Player list">
        <PlayersTableClient
          players={players}
          clubs={clubs}
          positions={positions}
          updatePlayer={updatePlayer}
          togglePlayerActive={togglePlayerActive}
        />
      </SectionCard>
    </div>
  );
}
