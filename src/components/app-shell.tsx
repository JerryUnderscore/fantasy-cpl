import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import ProfileSync from "@/components/profile-sync";
import AppHeader from "@/components/app-header";
import { getHeaderMatchweekInfo } from "@/lib/matchweek";
import AppFooter from "@/components/app-footer";
import OverlayProviders from "@/components/overlays/overlay-providers";
import MobileBottomNav from "@/components/nav/mobile-bottom-nav";

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

  let lineupLockAt: Date | null = null;
  let nextMatchweekStartsAt: Date | null = null;
  let currentMatchWeekStatus: string | null = null;

  if (user) {
    const headerInfo = await getHeaderMatchweekInfo();
    lineupLockAt = headerInfo.lineupLockAt;
    nextMatchweekStartsAt = headerInfo.nextMatchweekStartsAt;
    currentMatchWeekStatus = headerInfo.currentMatchWeekStatus;
  }

  return (
    <OverlayProviders>
      <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--text)]">
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
        <main className="mx-auto w-full max-w-[1300px] flex-1 px-6 py-8 pb-28 sm:pb-8">
          {children}
        </main>
        <AppFooter />
        <MobileBottomNav />
      </div>
    </OverlayProviders>
  );
}
