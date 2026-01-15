import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const clubs = [
  { name: "Atletico Ottawa", shortName: "Ottawa", slug: "atletico-ottawa" },
  { name: "Cavalry FC", shortName: "Cavalry", slug: "cavalry" },
  { name: "Forge FC", shortName: "Forge", slug: "forge" },
  { name: "HFX Wanderers FC", shortName: "HFX", slug: "hfx-wanderers" },
  { name: "Pacific FC", shortName: "Pacific", slug: "pacific" },
  { name: "FC Supra du Quebec", shortName: "Supra", slug: "supra" },
  { name: "Vancouver FC", shortName: "Vancouver", slug: "vancouver" },
  { name: "Inter Toronto FC", shortName: "Toronto", slug: "inter-toronto" },
];

async function main() {
  // Ensure we don't accidentally have multiple active seasons.
  await prisma.season.updateMany({
    where: { year: { not: 2026 }, isActive: true },
    data: { isActive: false },
  });

  const season = await prisma.season.upsert({
    where: { year: 2026 },
    create: { year: 2026, name: "2026 Beta", isActive: true },
    update: { name: "2026 Beta", isActive: true },
  });

  await Promise.all(
    clubs.map((club) =>
      prisma.club.upsert({
        where: { slug: club.slug },
        create: club,
        update: club,
      }),
    ),
  );

  const playerCount = await prisma.player.count({
    where: { seasonId: season.id },
  });

  console.log(
    `✅ Seed complete: season=${season.year} (active), clubs=${clubs.length}, players already in DB for this season=${playerCount}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });