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

  const players = season
    ? await prisma.player.findMany({
        where: { seasonId: season.id, active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          club: { select: { shortName: true, slug: true } },
        },
      })
    : [];

  const playerOptions = players.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    clubLabel: player.club?.shortName ?? player.club?.slug ?? "",
  }));

  const canWrite =
    process.env.ALLOW_DEV_STAT_WRITES === "true" || profile.isAdmin;

  return {
    season,
    playerOptions,
    matchWeeks,
    seasons,
    clubs,
    canWrite,
    isAdmin: profile.isAdmin,
  };
}
