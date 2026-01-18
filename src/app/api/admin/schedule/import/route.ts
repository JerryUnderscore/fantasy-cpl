import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { recalculateMatchWeekLockAt } from "@/lib/matchweek";
import { parseEasternDateTime } from "@/lib/time";
import { MatchStatus } from "@prisma/client";

export const runtime = "nodejs";

type CsvRow = {
  seasonYear: number;
  externalId: string;
  kickoffAt: Date;
  homeClubId: string;
  awayClubId: string;
  matchWeekNumber: number;
  status: MatchStatus;
};

type CsvError = {
  row: number;
  field: string;
  message: string;
};

const expectedHeaders = [
  "seasonYear",
  "externalId",
  "kickoffAtEastern",
  "homeClubSlug",
  "awayClubSlug",
  "matchWeekNumber",
  "status",
];

const normalizeName = (value: string) => value.trim().toLowerCase();

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
};

const matchKey = (seasonYear: number, externalId: string) =>
  `${seasonYear}|${externalId}`;

const allowedStatuses = new Set<MatchStatus>([
  MatchStatus.SCHEDULED,
  MatchStatus.POSTPONED,
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
]);

// Manual test checklist:
// - Upload a CSV with valid clubs and matchweeks; verify matchweeks are created and matches appear in DB.
// - Upload a CSV with a bad club name; confirm 400 with row-level errors and no writes.
// - Upload as a non-admin user; confirm 403 and no import.
export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();

    const formData = await request.formData();
    const file = formData.get("file");
    const seasonId =
      typeof formData.get("seasonId") === "string"
        ? String(formData.get("seasonId"))
        : null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing CSV file" },
        { status: 400 },
      );
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 },
      );
    }

    const rows = parseCsv(csvText);
    const [headerRow, ...dataRows] = rows;

    if (!headerRow) {
      return NextResponse.json(
        { error: "CSV file is missing headers" },
        { status: 400 },
      );
    }

    const normalizedHeaders = headerRow.map((value) => value.trim());
    const headerMatches =
      normalizedHeaders.length === expectedHeaders.length &&
      normalizedHeaders.every(
        (header, index) => header === expectedHeaders[index],
      );

    if (!headerMatches) {
      return NextResponse.json(
        { error: "CSV headers do not match expected format" },
        { status: 400 },
      );
    }

    const clubs = await prisma.club.findMany({
      select: { id: true, slug: true },
    });
    const clubMap = new Map(
      clubs.map((club) => [normalizeName(club.slug), club.id]),
    );

    const errors: CsvError[] = [];
    const entries: CsvRow[] = [];
    const seenMatches = new Set<string>();

    dataRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const values = expectedHeaders.map((_, colIndex) => row[colIndex] ?? "");
      const extraValues = row
        .slice(expectedHeaders.length)
        .some((value) => value.trim() !== "");

      if (extraValues) {
        errors.push({
          row: rowNumber,
          field: "row",
          message: "Too many columns in row.",
        });
      }

      if (values.every((value) => value.trim() === "")) {
        return;
      }

      const seasonYearRaw = values[0].trim();
      const externalIdRaw = values[1].trim();
      const kickoffAtRaw = values[2].trim();
      const homeClubRaw = values[3].trim();
      const awayClubRaw = values[4].trim();
      const matchWeekRaw = values[5].trim();
      const statusRaw = values[6].trim();

      if (!seasonYearRaw) {
        errors.push({
          row: rowNumber,
          field: "seasonYear",
          message: "seasonYear is required.",
        });
      }

      const seasonYear = Number(seasonYearRaw);
      if (!Number.isInteger(seasonYear) || seasonYear <= 0) {
        errors.push({
          row: rowNumber,
          field: "seasonYear",
          message: "seasonYear must be a valid year.",
        });
      }

      if (!externalIdRaw) {
        errors.push({
          row: rowNumber,
          field: "externalId",
          message: "externalId is required.",
        });
      }

      if (!kickoffAtRaw) {
        errors.push({
          row: rowNumber,
          field: "kickoffAtEastern",
          message: "kickoffAtEastern is required.",
        });
      }

      const kickoffAt = kickoffAtRaw ? parseEasternDateTime(kickoffAtRaw) : null;
      if (kickoffAtRaw && !kickoffAt) {
        errors.push({
          row: rowNumber,
          field: "kickoffAtEastern",
          message: "kickoffAtEastern must be YYYY-MM-DD HH:mm (ET).",
        });
      }

      if (!homeClubRaw) {
        errors.push({
          row: rowNumber,
          field: "homeClubSlug",
          message: "homeClubSlug is required.",
        });
      }

      if (!awayClubRaw) {
        errors.push({
          row: rowNumber,
          field: "awayClubSlug",
          message: "awayClubSlug is required.",
        });
      }

      const normalizedHome = normalizeName(homeClubRaw);
      const normalizedAway = normalizeName(awayClubRaw);

      if (normalizedHome && normalizedHome === normalizedAway) {
        errors.push({
          row: rowNumber,
          field: "homeClubSlug",
          message: "homeClubSlug and awayClubSlug must be different.",
        });
      }

      const homeClubId = normalizedHome ? clubMap.get(normalizedHome) : null;
      const awayClubId = normalizedAway ? clubMap.get(normalizedAway) : null;

      if (normalizedHome && !homeClubId) {
        errors.push({
          row: rowNumber,
          field: "homeClubSlug",
          message: "homeClubSlug does not match an existing club slug.",
        });
      }

      if (normalizedAway && !awayClubId) {
        errors.push({
          row: rowNumber,
          field: "awayClubSlug",
          message: "awayClubSlug does not match an existing club slug.",
        });
      }

      const matchWeekNumber = Number(matchWeekRaw);
      if (!Number.isInteger(matchWeekNumber) || matchWeekNumber <= 0) {
        errors.push({
          row: rowNumber,
          field: "matchWeekNumber",
          message: "matchWeekNumber must be a positive integer.",
        });
      }

      const normalizedStatus = statusRaw ? statusRaw.toUpperCase() : "SCHEDULED";
      const status = normalizedStatus as MatchStatus;
      if (!allowedStatuses.has(status)) {
        errors.push({
          row: rowNumber,
          field: "status",
          message: "status must be SCHEDULED, POSTPONED, COMPLETED, or CANCELED.",
        });
      }

      if (
        !kickoffAt ||
        !homeClubId ||
        !awayClubId ||
        !matchWeekNumber ||
        !seasonYear ||
        !externalIdRaw ||
        !allowedStatuses.has(status)
      ) {
        return;
      }

      const key = matchKey(seasonYear, externalIdRaw);
      if (seenMatches.has(key)) {
        errors.push({
          row: rowNumber,
          field: "row",
          message: "Duplicate match row in CSV.",
        });
        return;
      }
      seenMatches.add(key);

      entries.push({
        seasonYear,
        externalId: externalIdRaw,
        kickoffAt,
        homeClubId,
        awayClubId,
        matchWeekNumber,
        status,
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No schedule rows found in CSV." },
        { status: 400 },
      );
    }

    const seasonYears = new Set(entries.map((entry) => entry.seasonYear));
    if (seasonYears.size !== 1) {
      return NextResponse.json(
        { error: "CSV must contain exactly one seasonYear." },
        { status: 400 },
      );
    }

    const seasonYear = entries[0].seasonYear;
    const season = seasonId
      ? await prisma.season.findUnique({
          where: { id: seasonId },
          select: { id: true, year: true, name: true },
        })
      : await prisma.season.findUnique({
          where: { year: seasonYear },
          select: { id: true, year: true, name: true },
        });

    if (!season) {
      return NextResponse.json(
        { error: "Season not found for provided seasonYear." },
        { status: 404 },
      );
    }

    if (season.year !== seasonYear) {
      return NextResponse.json(
        { error: "seasonYear does not match the selected season." },
        { status: 400 },
      );
    }

    const matchWeekNumbers = Array.from(
      new Set(entries.map((entry) => entry.matchWeekNumber)),
    ).sort((a, b) => a - b);

    const existingMatchWeeks = await prisma.matchWeek.findMany({
      where: {
        seasonId: season.id,
        number: { in: matchWeekNumbers },
      },
      select: { id: true, number: true },
    });

    const existingWeekMap = new Map(
      existingMatchWeeks.map((matchWeek) => [matchWeek.number, matchWeek.id]),
    );

    const createdMatchWeeks = matchWeekNumbers.filter(
      (number) => !existingWeekMap.has(number),
    );

    if (createdMatchWeeks.length > 0) {
      await prisma.matchWeek.createMany({
        data: createdMatchWeeks.map((number) => ({
          seasonId: season.id,
          number,
          name: `MatchWeek ${number}`,
          status: "OPEN",
        })),
      });
    }

    const matchWeeks = await prisma.matchWeek.findMany({
      where: {
        seasonId: season.id,
        number: { in: matchWeekNumbers },
      },
      select: { id: true, number: true, name: true, status: true },
    });

    const matchWeekMap = new Map(
      matchWeeks.map((matchWeek) => [matchWeek.number, matchWeek.id]),
    );

    const createdMatchWeekRows = matchWeeks.filter((matchWeek) =>
      createdMatchWeeks.includes(matchWeek.number),
    );

    const existingMatches = await prisma.match.findMany({
      where: {
        seasonId: season.id,
        externalId: { in: entries.map((entry) => entry.externalId) },
      },
      select: { externalId: true },
    });

    const existingMatchIds = new Set(
      existingMatches.map((match) => match.externalId),
    );

    let updatedCount = 0;
    let createdCount = 0;

    const upsertOperations = entries.map((entry) => {
      const matchWeekId = matchWeekMap.get(entry.matchWeekNumber) ?? null;
      if (existingMatchIds.has(entry.externalId)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }

      return prisma.match.upsert({
        where: {
          seasonId_externalId: {
            seasonId: season.id,
            externalId: entry.externalId,
          },
        },
        create: {
          seasonId: season.id,
          externalId: entry.externalId,
          kickoffAt: entry.kickoffAt,
          homeClubId: entry.homeClubId,
          awayClubId: entry.awayClubId,
          matchWeekId,
          status: entry.status,
        },
        update: {
          kickoffAt: entry.kickoffAt,
          homeClubId: entry.homeClubId,
          awayClubId: entry.awayClubId,
          matchWeekId,
          status: entry.status,
        },
      });
    });

    const chunkSize = 25;
    for (let index = 0; index < upsertOperations.length; index += chunkSize) {
      const chunk = upsertOperations.slice(index, index + chunkSize);
      await prisma.$transaction(chunk);
    }

    const touchedMatchWeekIds = entries
      .map((entry) => matchWeekMap.get(entry.matchWeekNumber))
      .filter((id): id is string => Boolean(id));

    const { updatedCount: lockAtUpdatedCount } =
      await recalculateMatchWeekLockAt(touchedMatchWeekIds);

    return NextResponse.json({
      importedCount: entries.length,
      updatedCount,
      createdCount,
      matchWeeksCreatedCount: createdMatchWeeks.length,
      createdMatchWeeks: createdMatchWeekRows,
      lockAtUpdatedCount,
      season,
      errors: [],
      warnings: [],
    });
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as { status?: number }).status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("POST /api/admin/schedule/import error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
