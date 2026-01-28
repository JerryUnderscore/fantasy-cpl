import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

async function setAdminStatus(formData: FormData) {
  "use server";
  await requireAdminUser();

  const profileId = formData.get("profileId");
  const nextValue = formData.get("nextIsAdmin");

  if (typeof profileId !== "string" || typeof nextValue !== "string") {
    return;
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: { isAdmin: nextValue === "true" },
  });

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        select: { role: true, leagueId: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Admin"
        title="Users"
        subtitle="Manage player accounts, admin access, and commissioner status."
      />

      <SectionCard title="Accounts">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Leagues</th>
                <th className="px-4 py-3">Commissioner</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {profiles.map((profile) => {
                const leagueCount = profile.memberships.length;
                const commissionerCount = profile.memberships.filter(
                  (membership) => membership.role === "OWNER",
                ).length;

                return (
                  <tr key={profile.id} className="text-[var(--text)]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--text)]">
                        {profile.displayName ?? "Unnamed"}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Discord ID: {profile.discordId ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {leagueCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {commissionerCount > 0
                        ? `Yes (${commissionerCount})`
                        : "No"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {profile.isAdmin ? "Admin" : "Standard"}
                    </td>
                    <td className="px-4 py-3">
                      <form action={setAdminStatus}>
                        <input
                          type="hidden"
                          name="profileId"
                          value={profile.id}
                        />
                        <input
                          type="hidden"
                          name="nextIsAdmin"
                          value={profile.isAdmin ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                        >
                          {profile.isAdmin ? "Revoke admin" : "Make admin"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
