import Link from "next/link";
import CreateLeagueForm from "@/components/leagues/create-league-form";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export default function CreateLeaguePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeader
          title="Create a league"
          subtitle="Choose the defaults for your league before inviting friends."
        />
        <SectionCard title="League settings">
          <CreateLeagueForm submitLabel="Create league" />
        </SectionCard>
        <Link
          href="/leagues"
          className="inline-flex items-center text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          Back to leagues
        </Link>
      </div>
    </div>
  );
}
