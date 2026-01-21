import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";

export async function getAdminConsoleData() {
  const { profile } = await requireAdminUser();

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
    select: { slug: true, name: true, shortName: true },
  });

  const matchWeeks = season
    ? await prisma.matchWeek.findMany({
        where: { seasonId: season.id },
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true, status: true },
      })
    : [];

  const canWrite =
    process.env.ALLOW_DEV_STAT_WRITES === "true" || profile.isAdmin;

  return {
    season,
    matchWeeks,
    seasons,
    clubs,
    canWrite,
    isAdmin: profile.isAdmin,
  };
}
