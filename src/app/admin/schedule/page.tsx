import ScoringAdminClient from "@/app/scoring-admin/scoring-admin-client";
import { getAdminConsoleData } from "@/app/admin/admin-data";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";
import AdminMobileReadonly from "@/components/admin/admin-mobile-readonly";

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
      <SectionCard
        title="Schedule"
        description="Create or activate a season before managing the schedule."
      >
        <p className="text-sm text-[var(--text-muted)]">
          No active season found.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Admin"
        title="Schedule"
        subtitle="Import matches, edit kickoff times, or remove test fixtures."
      />

      <SectionCard title="Schedule tools">
        <div className="hidden sm:block">
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
        <AdminMobileReadonly matchWeeks={matchWeeks} title="Schedule summary" />
      </SectionCard>
    </div>
  );
}
