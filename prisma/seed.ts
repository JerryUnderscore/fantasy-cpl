import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const clubs = [
  { name: "Atletico Ottawa", shortName: "Ottawa", slug: "atletico-ottawa" },
  { name: "Cavalry FC", shortName: "Cavalry", slug: "cavalry" },
  { name: "Forge FC", shortName: "Forge", slug: "forge" },
  { name: "HFX Wanderers FC", shortName: "HFX", slug: "hfx-wanderers" },
  { name: "Pacific FC", shortName: "Pacific", slug: "pacific" },
  { name: "Valour FC", shortName: "Valour", slug: "valour" },
  { name: "Vancouver FC", shortName: "Vancouver", slug: "vancouver" },
  { name: "York United FC", shortName: "York", slug: "york-united" },
];

const players = [
  { name: "Ollie Bassett", position: "MID", clubSlug: "atletico-ottawa" },
  { name: "Malcolm Shaw", position: "FWD", clubSlug: "atletico-ottawa" },
  { name: "Marco Carducci", position: "GK", clubSlug: "cavalry" },
  { name: "Shamit Shome", position: "MID", clubSlug: "cavalry" },
  { name: "Tristan Borges", position: "MID", clubSlug: "forge" },
  { name: "Woobens Pacius", position: "FWD", clubSlug: "forge" },
  { name: "Ryan Telfer", position: "MID", clubSlug: "hfx-wanderers" },
  { name: "Dan Nimick", position: "DEF", clubSlug: "hfx-wanderers" },
  { name: "Manny Aparicio", position: "MID", clubSlug: "pacific" },
  {
    name: "Thomas Meilleur-Giguere",
    position: "DEF",
    clubSlug: "pacific",
  },
  { name: "William Akio", position: "FWD", clubSlug: "valour" },
  { name: "Kelsey Egbo", position: "FWD", clubSlug: "valour" },
  { name: "Callum Irving", position: "GK", clubSlug: "vancouver" },
  { name: "Terran Campbell", position: "FWD", clubSlug: "vancouver" },
  { name: "Osaze De Rosario", position: "FWD", clubSlug: "york-united" },
  { name: "Max Ferrari", position: "DEF", clubSlug: "york-united" },
];

async function main() {
  const season = await prisma.season.upsert({
    where: { year: 2026 },
    create: { year: 2026, name: "2026 Beta", isActive: true },
    update: { name: "2026 Beta", isActive: true },
  });

  const clubRecords = await Promise.all(
    clubs.map((club) =>
      prisma.club.upsert({
        where: { slug: club.slug },
        create: club,
        update: club,
      }),
    ),
  );

  const clubBySlug = new Map(
    clubRecords.map((club) => [club.slug, club.id]),
  );

  for (const player of players) {
    const clubId = clubBySlug.get(player.clubSlug);
    if (!clubId) {
      throw new Error(`Missing club for slug: ${player.clubSlug}`);
    }

    await prisma.player.upsert({
      where: {
        seasonId_name: {
          seasonId: season.id,
          name: player.name,
        },
      },
      create: {
        name: player.name,
        position: player.position as "GK" | "DEF" | "MID" | "FWD",
        seasonId: season.id,
        clubId,
      },
      update: {
        position: player.position as "GK" | "DEF" | "MID" | "FWD",
        clubId,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
