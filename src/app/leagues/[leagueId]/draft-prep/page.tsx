import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function DraftPrepPage({
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
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Sign in to access draft prep tools.
      </div>
    );
  }

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_profileId: { leagueId, profileId: user.id } },
    select: { id: true },
  });

  if (!membership) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        You need to join this league before accessing draft prep tools.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Draft prep
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Pre-rank players
        </h1>
        <p className="text-sm text-zinc-500">
          Coming soon. This space will let you build rankings and a draft board.
        </p>
      </div>
      <Link
        href={`/leagues/${leagueId}`}
        className="text-sm font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
      >
        Back to league
      </Link>
    </div>
  );
}
