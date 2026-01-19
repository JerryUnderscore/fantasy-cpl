import { prisma } from "@/lib/prisma";
import PlayersClient from "./players-client";

export const runtime = "nodejs";

export default async function PlayersPage() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      players: {
        where: { active: true },
        include: { club: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!season) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">Players</h1>
          <p className="text-sm text-zinc-500">No active season found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-black">
            {season.name} Players
          </h1>
          <p className="text-sm text-zinc-500">
            Active season player pool.
          </p>
        </div>

        <PlayersClient players={season.players} />
      </div>
    </div>
  );
}
