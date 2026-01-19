import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import ProfileSync from "@/components/profile-sync";
import UserMenu from "@/components/user-menu";

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1300px] items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            Fantasy CPL
          </Link>
          <UserMenu
            isAuthenticated={Boolean(user)}
            displayName={displayName}
            avatarUrl={avatarUrl}
            hasOwnedLeagues={hasOwnedLeagues}
            isAdmin={isAdmin}
          />
        </div>
      </header>
      <ProfileSync isAuthenticated={Boolean(user)} />
      <main className="mx-auto w-full max-w-[1300px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
