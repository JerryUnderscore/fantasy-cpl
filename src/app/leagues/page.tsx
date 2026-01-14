import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";
import LeagueActions from "@/app/leagues/league-actions";

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

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-black">
              Invite-only leagues
            </h1>
            <p className="text-sm text-zinc-500">
              Sign in to create or join your league.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
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
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Profile not synced
          </h1>
          <p className="text-sm text-zinc-500">
            Please sync your profile from the home page and try again.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const memberships = await getMemberships(profile.id);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-black">Your leagues</h1>
          <p className="text-sm text-zinc-500">
            Create a league or join one with an invite code.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          {memberships.length === 0 ? (
            <p className="text-sm text-zinc-500">
              You are not in any leagues yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {memberships.map((membership) => (
                <li
                  key={membership.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/leagues/${membership.league.id}`}
                        className="text-base font-semibold text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {membership.league.name}
                      </Link>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        {membership.league.season.name} ·{" "}
                        {membership.league.season.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leagues/${membership.league.id}`}
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                      >
                        View
                      </Link>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        {membership.role}
                      </span>
                    </div>
                  </div>
                  {membership.role === "OWNER" ? (
                    <div className="text-sm text-zinc-600">
                      Invite code:{" "}
                      <span className="font-semibold text-zinc-900">
                        {membership.league.inviteCode}
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <LeagueActions />
      </div>
    </div>
  );
}
