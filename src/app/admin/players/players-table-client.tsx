 "use client";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";

type Position = "GK" | "DEF" | "MID" | "FWD";

type ClubOption = {
  id: string;
  name: string;
  shortName: string | null;
};

type PlayerRow = {
  id: string;
  name: string;
  position: Position;
  active: boolean;
  clubId: string;
  jerseyNumber: number | null;
  club: { name: string; shortName: string | null } | null;
};

type Props = {
  players: PlayerRow[];
  clubs: ClubOption[];
  positions: readonly Position[];
  updatePlayer: (formData: FormData) => Promise<void>;
  togglePlayerActive: (formData: FormData) => Promise<void>;
};

export default function PlayersTableClient({
  players,
  clubs,
  positions,
  updatePlayer,
  togglePlayerActive,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3">Jersey</th>
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
                  <span>
                    {formatPlayerName(player.name, player.jerseyNumber)}
                  </span>
                  {!player.active ? (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      Hidden
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600">
                {player.jerseyNumber ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600">
                {getClubDisplayName(player.club?.slug, player.club?.name)}
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-zinc-600">
                {player.position}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updatePlayer} className="flex items-center gap-2">
                    <input type="hidden" name="playerId" value={player.id} />
                    <input
                      type="number"
                      name="jerseyNumber"
                      defaultValue={player.jerseyNumber ?? ""}
                      placeholder="Jersey #"
                      min="0"
                      className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900"
                    />
                    <select
                      name="clubId"
                      defaultValue={player.clubId}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900"
                    >
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                      {getClubDisplayName(club.slug, club.name)}
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
  );
}
