import { notFound, redirect } from "next/navigation";

export const runtime = "nodejs";

type LeagueParams = { leagueId: string };

export default async function Page({
  params,
}: {
  params: Promise<LeagueParams>;
}) {
  const { leagueId } = await params;
  if (!leagueId) notFound();

  redirect(`/leagues/${leagueId}/draft`);
}
