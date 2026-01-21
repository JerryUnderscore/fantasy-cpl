import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import LeagueActions from "@/app/leagues/league-actions";
import AvailableLeaguesClient from "@/app/leagues/available-leagues-client";

export const runtime = "nodejs";

const getMemberships = async (profileId: string) => {
  return prisma.leagueMember.findMany({
    where: { profileId },
    include: {
      league: {
        include: {
          season: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const getOpenLeagues = async (profileId: string) => {
  return prisma.league.findMany({
    where: {
      joinMode: "OPEN",
      members: {
        none: { profileId },
      },
    },
    select: {
      id: true,
      name: true,
      maxTeams: true,
      season: { select: { name: true, year: true } },
      _count: { select: { teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-[var(--text)]">
              Invite-only leagues
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Sign in to create or join your league.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Profile not synced
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Please sync your profile from the home page and try again.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const memberships = await getMemberships(profile.id);
  const openLeagues = await getOpenLeagues(profile.id);

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Your leagues
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Create a league or join one with an invite code.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          {memberships.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              You are not in any leagues yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {memberships.map((membership) => (
                <li
                  key={membership.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/leagues/${membership.league.id}`}
                        className="text-base font-semibold text-[var(--text)] underline-offset-4 hover:underline"
                      >
                        {membership.league.name}
                      </Link>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        {membership.league.season.name} ·{" "}
                        {membership.league.season.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leagues/${membership.league.id}`}
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                      >
                        View
                      </Link>
                      <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {membership.role}
                      </span>
                    </div>
                  </div>
                  {membership.role === "OWNER" ? (
                    <div className="text-sm text-[var(--text-muted)]">
                      Invite code:{" "}
                      <span className="font-semibold text-[var(--text)]">
                        {membership.league.inviteCode}
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <AvailableLeaguesClient leagues={openLeagues} />

        <LeagueActions />
      </div>
    </div>
  );
}
