import { prisma } from "@/lib/prisma";
import PlayersClient from "./players-client";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";
import EmptyState from "@/components/layout/empty-state";

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
      <div className="min-h-screen bg-[var(--background)] px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <PageHeader title="CPL player stats" subtitle="CPL player stats for the beta season." />
          <EmptyState
            title="No active season"
            description="Create or activate a season to view CPL player stats."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <PageHeader
          title="CPL player stats"
          subtitle={`CPL player stats for the beta season (${season.name}).`}
        />
        <SectionCard title="Player stats">
          <PlayersClient players={season.players} />
        </SectionCard>
      </div>
    </div>
  );
}
