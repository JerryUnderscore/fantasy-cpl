import ScoringAdminClient from "@/app/scoring-admin/scoring-admin-client";
import { getAdminConsoleData } from "@/app/admin/admin-data";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

export default async function AdminMatchweeksPage() {
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
        title="Matchweeks"
        description="Create or activate a season before managing matchweeks."
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
        title="Matchweeks"
        subtitle={`Manage matchweek lifecycle and stats · ${season.name} ${season.year}`}
      />

      <SectionCard title="Matchweek tools">
        <ScoringAdminClient
          postUrl="/api/scoring/stats"
          matchWeeks={matchWeeks}
          seasons={seasons}
          clubs={clubs}
          canWrite={canWrite}
          isAdmin={isAdmin}
          showScheduleImport={false}
          showMatchesEditor={false}
        />
      </SectionCard>
    </div>
  );
}
