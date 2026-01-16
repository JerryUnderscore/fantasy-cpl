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

  const matchWeek = await prisma.matchWeek.upsert({
    where: {
      seasonId_number: {
        seasonId: season.id,
        number: 1,
      },
    },
    create: {
      seasonId: season.id,
      number: 1,
      name: "MatchWeek 1",
      status: "OPEN",
    },
    update: {
      name: "MatchWeek 1",
      status: "OPEN",
    },
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

  const samplePlayers = await prisma.player.findMany({
    where: { seasonId: season.id },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true },
  });

  const statTemplates = [
    {
      minutes: 90,
      goals: 1,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      cleanSheet: true,
    },
    {
      minutes: 75,
      goals: 0,
      assists: 2,
      yellowCards: 1,
      redCards: 0,
      ownGoals: 0,
      cleanSheet: false,
    },
    {
      minutes: 60,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 1,
      ownGoals: 0,
      cleanSheet: false,
    },
    {
      minutes: 30,
      goals: 1,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 1,
      cleanSheet: false,
    },
    {
      minutes: 90,
      goals: 2,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      cleanSheet: true,
    },
    {
      minutes: 15,
      goals: 0,
      assists: 0,
      yellowCards: 1,
      redCards: 0,
      ownGoals: 0,
      cleanSheet: false,
    },
  ];

  const sampleStats = samplePlayers.slice(0, statTemplates.length).map(
    (player, index) => ({
      playerId: player.id,
      matchWeekId: matchWeek.id,
      ...statTemplates[index],
    }),
  );

  if (sampleStats.length) {
    await prisma.$transaction(
      sampleStats.map((stat) =>
        prisma.playerMatchStat.upsert({
          where: {
            playerId_matchWeekId: {
              playerId: stat.playerId,
              matchWeekId: stat.matchWeekId,
            },
          },
          create: stat,
          update: stat,
        }),
      ),
    );
  }

  console.log(
    `✅ Seed complete: season=${season.year} (active), clubs=${clubs.length}, players already in DB for this season=${playerCount}, matchWeek=${matchWeek.number}, sampleStats=${sampleStats.length}`,
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
