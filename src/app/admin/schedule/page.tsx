import ScoringAdminClient from "@/app/scoring-admin/scoring-admin-client";
import { getAdminConsoleData } from "@/app/admin/admin-data";

export const runtime = "nodejs";

export default async function AdminSchedulePage() {
  const {
    season,
    matchWeeks,
    seasons,
    clubs,
    canWrite,
    isAdmin,
  } = await getAdminConsoleData();

  if (!season) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Create or activate a season before managing the schedule.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Schedule
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Schedule controls
        </h1>
        <p className="text-sm text-zinc-500">
          Import matches, edit kickoff times, or remove test fixtures.
        </p>
      </div>

      <ScoringAdminClient
        postUrl="/api/scoring/stats"
        matchWeeks={matchWeeks}
        seasons={seasons}
        clubs={clubs}
        canWrite={canWrite}
        isAdmin={isAdmin}
        showDevTools={false}
        showMatchWeekControls={false}
        showStatsEditor={false}
        showScheduleImport
        showMatchesEditor
      />
    </div>
  );
}
