import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import ProfileSync from "@/components/profile-sync";
import AppHeader from "@/components/app-header";
import {
  getActiveSeason,
  getCurrentMatchWeekForSeason,
} from "@/lib/matchweek";

type AppShellProps = {
  children: React.ReactNode;
};

export default async function AppShell({ children }: AppShellProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let hasOwnedLeagues = false;

  if (user) {
    profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { displayName: true, avatarUrl: true, isAdmin: true },
    });

    const ownerMembership = await prisma.leagueMember.findFirst({
      where: { profileId: user.id, role: "OWNER" },
      select: { leagueId: true },
    });

    hasOwnedLeagues = Boolean(ownerMembership);
  }

  const displayName =
    profile?.displayName ??
    user?.user_metadata?.full_name ??
    user?.email ??
    "Account";
  const avatarUrl = profile?.avatarUrl ?? user?.user_metadata?.avatar_url ?? null;
  const isAdmin = profile?.isAdmin ?? false;
  const isAuthenticated = Boolean(user);

  const activeSeason = await getActiveSeason();
  let lineupLockAt: Date | null = null;
  let nextMatchweekStartsAt: Date | null = null;
  let currentMatchWeekStatus: string | null = null;

  if (activeSeason) {
    const currentMatchWeek = await getCurrentMatchWeekForSeason(activeSeason.id);
    if (currentMatchWeek) {
      currentMatchWeekStatus = currentMatchWeek.status;
      const earliestCurrentKickoff = await prisma.match.findFirst({
        where: { matchWeekId: currentMatchWeek.id },
        orderBy: { kickoffAt: "asc" },
        select: { kickoffAt: true },
      });
      lineupLockAt =
        earliestCurrentKickoff?.kickoffAt ?? currentMatchWeek.lockAt ?? null;

      const nextMatchWeek = await prisma.matchWeek.findFirst({
        where: {
          seasonId: activeSeason.id,
          number: { gt: currentMatchWeek.number },
        },
        orderBy: { number: "asc" },
        select: { id: true, lockAt: true },
      });

      if (nextMatchWeek) {
        const earliestNextKickoff = await prisma.match.findFirst({
          where: { matchWeekId: nextMatchWeek.id },
          orderBy: { kickoffAt: "asc" },
          select: { kickoffAt: true },
        });
        nextMatchweekStartsAt =
          earliestNextKickoff?.kickoffAt ?? nextMatchWeek.lockAt ?? null;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <AppHeader
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        avatarUrl={avatarUrl}
        hasOwnedLeagues={hasOwnedLeagues}
        isAdmin={isAdmin}
        lineupLockAt={lineupLockAt?.toISOString() ?? null}
        nextMatchweekStartsAt={nextMatchweekStartsAt?.toISOString() ?? null}
        currentMatchWeekStatus={currentMatchWeekStatus}
      />
      <ProfileSync isAuthenticated={Boolean(user)} />
      <main className="mx-auto w-full max-w-[1300px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
