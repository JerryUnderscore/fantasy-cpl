import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.profile.findUnique({
        where: { id: user.id },
        select: { displayName: true },
      })
    : null;

  const memberships = user
    ? await prisma.leagueMember.findMany({
        where: { profileId: user.id },
        include: { league: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Welcome back
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          {user
            ? `Manage your teams and leagues${profile?.displayName ? ", " + profile.displayName : ""}.`
            : "Sign in to view your leagues and manage your teams."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/leagues"
          className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                My Leagues
              </h2>
              <p className="text-sm text-zinc-500">
                View your teams, standings, and drafts.
              </p>
            </div>
            <span className="text-sm font-semibold text-zinc-400 transition group-hover:text-zinc-600">
              View
            </span>
          </div>
        </Link>
        <Link
          href="/players"
          className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Players
              </h2>
              <p className="text-sm text-zinc-500">
                Browse the current player pool.
              </p>
            </div>
            <span className="text-sm font-semibold text-zinc-400 transition group-hover:text-zinc-600">
              Browse
            </span>
          </div>
        </Link>
      </div>

      {user ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">
              Your leagues
            </h3>
            <Link
              href="/leagues"
              className="text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
            >
              Manage
            </Link>
          </div>
          {memberships.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              You have not joined any leagues yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {memberships.slice(0, 4).map((membership) => (
                <li
                  key={membership.id}
                  className="rounded-xl border border-zinc-200 px-4 py-3"
                >
                  <Link
                    href={`/leagues/${membership.league.id}`}
                    className="text-sm font-semibold text-zinc-900 hover:underline"
                  >
                    {membership.league.name}
                  </Link>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {membership.role}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          Sign in to see your leagues and personalize your dashboard.
        </section>
      )}
    </div>
  );
}
