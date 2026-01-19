import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export default async function LeagueSettingsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Sign in to view your league settings.
      </div>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Profile not synced yet. Refresh after syncing your profile.
      </div>
    );
  }

  const ownedLeagues = await prisma.leagueMember.findMany({
    where: { profileId: profile.id, role: "OWNER" },
    include: { league: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          League settings
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Your commissioner tools
        </h1>
        <p className="text-sm text-zinc-500">
          Choose a league to manage scoring, roster settings, and drafts.
        </p>
      </div>

      {ownedLeagues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          You are not the commissioner of any leagues yet.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ownedLeagues.map((membership) => (
            <li
              key={membership.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-zinc-900">
                {membership.league.name}
              </p>
              <Link
                href={`/leagues/${membership.league.id}/settings`}
                className="mt-3 inline-flex text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
              >
                Open settings
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
