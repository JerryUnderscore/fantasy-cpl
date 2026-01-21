import { prisma } from "../src/lib/prisma";

const run = async () => {
  const updated = await prisma.teamMatchWeekLineupSlot.updateMany({
    where: { isStarter: true, playerId: null },
    data: { isStarter: false },
  });

  console.log(
    `Cleared starter flags on ${updated.count} lineup slot(s) with no player.`,
  );
};

run()
  .catch((error) => {
    console.error("Backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
