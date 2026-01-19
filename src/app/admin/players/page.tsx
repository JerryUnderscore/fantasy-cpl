import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";

export const runtime = "nodejs";

const positions = ["GK", "DEF", "MID", "FWD"] as const;

async function createPlayer(formData: FormData) {
  "use server";
  await requireAdminUser();

  const name = formData.get("name");
  const position = formData.get("position");
  const clubId = formData.get("clubId");
  const seasonId = formData.get("seasonId");

  if (
    typeof name !== "string" ||
    typeof position !== "string" ||
    typeof clubId !== "string" ||
    typeof seasonId !== "string" ||
    !name.trim()
  ) {
    return;
  }

  await prisma.player.create({
    data: {
      name: name.trim(),
      position,
      clubId,
      seasonId,
      active: true,
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

  if (
    typeof playerId !== "string" ||
    typeof position !== "string" ||
    typeof clubId !== "string"
  ) {
    return;
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { position, clubId },
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
    select: { id: true, name: true, shortName: true },
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
          club: { select: { name: true, shortName: true } },
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
                {club.shortName ?? club.name}
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

      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Club</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {players.map((player) => (
              <tr key={player.id} className="text-zinc-800">
                <td className="px-4 py-3 font-semibold text-zinc-900">
                  <div className="flex items-center gap-2">
                    <span>{player.name}</span>
                    {!player.active ? (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600">
                  {player.club?.shortName ?? player.club?.name}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-zinc-600">
                  {player.position}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={updatePlayer} className="flex items-center gap-2">
                      <input type="hidden" name="playerId" value={player.id} />
                      <select
                        name="clubId"
                        defaultValue={player.clubId}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900"
                      >
                        {clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.shortName ?? club.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="position"
                        defaultValue={player.position}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900"
                      >
                        {positions.map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                      >
                        Save
                      </button>
                    </form>
                    <form action={togglePlayerActive}>
                      <input type="hidden" name="playerId" value={player.id} />
                      <input
                        type="hidden"
                        name="nextActive"
                        value={player.active ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          player.active
                            ? "border-amber-200 text-amber-700"
                            : "border-emerald-200 text-emerald-700"
                        }`}
                      >
                        {player.active ? "Hide" : "Show"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
