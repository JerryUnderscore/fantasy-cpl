import ScoringAdminClient from "@/app/scoring-admin/scoring-admin-client";
import { getAdminConsoleData } from "@/app/admin/admin-data";

export const runtime = "nodejs";

export default async function AdminMatchweeksPage() {
  const {
    season,
    playerOptions,
    matchWeeks,
    seasons,
    clubs,
    canWrite,
    isAdmin,
  } = await getAdminConsoleData();

  if (!season) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Create or activate a season before managing matchweeks.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Matchweek controls
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Matchweek lifecycle + stats
        </h1>
        <p className="text-sm text-zinc-500">
          {season.name} - {season.year}
        </p>
      </div>

      <ScoringAdminClient
        postUrl="/api/scoring/stats"
        players={playerOptions}
        matchWeeks={matchWeeks}
        seasons={seasons}
        clubs={clubs}
        canWrite={canWrite}
        isAdmin={isAdmin}
        showScheduleImport={false}
        showMatchesEditor={false}
      />
    </div>
  );
}
