import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import PlayersTableClient from "./players-table-client";
import { getClubDisplayName } from "@/lib/clubs";

export const runtime = "nodejs";

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionSet = new Set(positions);

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
      if (char === "," ) {
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

  if (!(file instanceof File) || typeof seasonId !== "string") {
    return;
  }

  const csv = await file.text();
  const rows = parseCsv(csv);
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
    if (club.shortName) {
      clubMap.set(club.shortName.toLowerCase(), club.id);
    }
    if (club.slug) {
      clubMap.set(club.slug.toLowerCase(), club.id);
    }
    clubMap.set(club.name.toLowerCase(), club.id);
  });

  const operations: Array<ReturnType<typeof prisma.player.upsert>> = [];

  for (const row of rows.slice(1)) {
    const name = row[nameIndex]?.trim();
    const positionRaw = row[positionIndex]?.trim().toUpperCase();
    const clubLabel = row[clubIndex]?.trim().toLowerCase();
    if (!name || !positionRaw || !clubLabel) {
      continue;
    }
    if (!positionSet.has(positionRaw as (typeof positions)[number])) {
      continue;
    }
    const clubId = clubMap.get(clubLabel);
    if (!clubId) {
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
          position: positionRaw as (typeof positions)[number],
          clubId,
          jerseyNumber,
          active: true,
        },
        create: {
          name,
          seasonId,
          clubId,
          position: positionRaw as (typeof positions)[number],
          jerseyNumber,
          active: true,
        },
      }),
    );
  }

  if (operations.length === 0) {
    return;
  }

  await prisma.$transaction(operations);
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
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Create or activate a season before editing players.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Player controls
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Manage player pool
        </h1>
        <p className="text-sm text-zinc-500">
          Active season: {season.name} - {season.year}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-sm font-semibold text-zinc-900">Add new player</p>
        <form action={createPlayer} className="mt-4 grid gap-3 sm:grid-cols-4">
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
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-sm font-semibold text-zinc-900">Import players</p>
        <p className="mt-1 text-xs text-zinc-500">
          CSV columns: name, position, club (shortName or name), jerseyNumber.
        </p>
        <form
          action={importPlayersCsv}
          className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto]"
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
      </div>

      <PlayersTableClient
        players={players}
        clubs={clubs}
        positions={positions}
        updatePlayer={updatePlayer}
        togglePlayerActive={togglePlayerActive}
      />
    </div>
  );
}
