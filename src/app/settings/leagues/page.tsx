import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

export default async function LeagueSettingsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SectionCard
        title="League settings"
        description="Sign in to view your league settings."
      >
        <p className="text-sm text-[var(--text-muted)]">
          Authentication required.
        </p>
      </SectionCard>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <SectionCard
        title="League settings"
        description="Profile not synced yet. Refresh after syncing your profile."
      >
        <p className="text-sm text-[var(--text-muted)]">
          Sync required.
        </p>
      </SectionCard>
    );
  }

  const ownedLeagues = await prisma.leagueMember.findMany({
    where: { profileId: profile.id, role: "OWNER" },
    include: { league: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Commissioner"
        title="League settings"
        subtitle="Choose a league to manage scoring, roster settings, and drafts."
      />

      {ownedLeagues.length === 0 ? (
        <SectionCard title="No leagues yet">
          <p className="text-sm text-[var(--text-muted)]">
            You are not the commissioner of any leagues yet.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title="Your leagues">
          <ul className="grid gap-3 sm:grid-cols-2">
            {ownedLeagues.map((membership) => (
              <li
                key={membership.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--text)]">
                  {membership.league.name}
                </p>
                <Link
                  href={`/leagues/${membership.league.id}/settings`}
                  className="mt-3 inline-flex text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Open settings
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
