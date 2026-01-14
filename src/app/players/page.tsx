import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function PlayersPage() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      players: {
        include: { club: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!season) {
    return (
      <main>
        <h1>Players</h1>
        <p>No active season found.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{season.name} Players</h1>
      <ul>
        {season.players.map((player) => (
          <li key={player.id}>
            {player.name} - {player.position} - {player.club.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
