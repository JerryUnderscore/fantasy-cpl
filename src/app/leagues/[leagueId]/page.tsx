import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AuthButtons from "@/components/auth-buttons";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

async function getLeague(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: { season: true },
  });
}

async function getMembership(leagueId: string, profileId: string) {
  return prisma.leagueMember.findUnique({
    where: { leagueId_profileId: { leagueId, profileId } },
  });
}

async function getTeams(leagueId: string) {
  return prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      profile: { select: { displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export default async function LeagueDetailPage({
  params,
}: {
  params: LeagueParams | Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-black">League teams</h1>
            <p className="text-sm text-zinc-500">
              Sign in to view the teams in this league.
            </p>
          </div>
          <AuthButtons isAuthenticated={false} />
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
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

  const league = await getLeague(leagueId);
  if (!league) notFound();

  const membership = await getMembership(league.id, profile.id);
  if (!membership) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-black">
            Not a league member
          </h1>
          <p className="text-sm text-zinc-500">
            You need to join this league before viewing its teams.
          </p>
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  // Server Action (inline)
  async function createTeamAction(formData: FormData) {
    "use server";

    const rawName = (formData.get("teamName") ?? "").toString();
    const teamName = rawName.trim();

    if (!teamName) {
      // simplest: just bounce back to page; later we can show inline errors
      redirect(`/leagues/${leagueId}`);
    }

    // Re-check auth on server action
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect(`/leagues/${leagueId}`);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

    if (!profile) redirect(`/`);

    // Ensure league exists + user is a member
    const member = await prisma.leagueMember.findUnique({
      where: { leagueId_profileId: { leagueId, profileId: profile.id } },
      select: { id: true },
    });

    if (!member) redirect(`/leagues`);

    // Enforce 1 team per league per profile (upsert by compound unique)
    await prisma.fantasyTeam.upsert({
      where: {
        leagueId_profileId: {
          leagueId,
          profileId: profile.id,
        },
      },
      create: {
        name: teamName,
        leagueId,
        profileId: profile.id,
      },
      update: {
        name: teamName,
      },
    });

    revalidatePath(`/leagues/${leagueId}`);
    redirect(`/leagues/${leagueId}`);
  }

  const teams = await getTeams(league.id);
  const currentTeam = teams.find((t) => t.profileId === profile.id) ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <Link
            href="/leagues"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-black hover:underline"
          >
            Back to leagues
          </Link>
          <h1 className="text-3xl font-semibold text-black">{league.name}</h1>
          <p className="text-sm text-zinc-500">
            {league.season.name} · {league.season.year}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-zinc-900">Your team</p>
              <p className="text-sm text-zinc-600">
                {currentTeam?.name ?? "Team not created yet."}
              </p>
            </div>

            {/* Create or rename team */}
            <form action={createTeamAction} className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {currentTeam ? "Rename your team" : "Create your team"}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  name="teamName"
                  defaultValue={currentTeam?.name ?? ""}
                  placeholder="e.g., Harbour City XI"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-300"
                  maxLength={40}
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-900"
                >
                  {currentTeam ? "Save" : "Create"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                One team per league. You can rename anytime.
              </p>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            League teams
          </h2>

          {teams.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No teams yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <p className="text-base font-semibold text-zinc-900">
                    {t.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    Owner: {t.profile.displayName ?? "Unknown"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}