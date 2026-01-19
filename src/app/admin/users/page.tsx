import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";

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
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Users
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Player accounts
        </h1>
        <p className="text-sm text-zinc-500">
          Promote admins and view commissioner status by league membership.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Leagues</th>
              <th className="px-4 py-3">Commissioner</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {profiles.map((profile) => {
              const leagueCount = profile.memberships.length;
              const commissionerCount = profile.memberships.filter(
                (membership) => membership.role === "OWNER",
              ).length;

              return (
                <tr key={profile.id} className="text-zinc-800">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">
                      {profile.displayName ?? "Unnamed"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Discord ID: {profile.discordId ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {leagueCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {commissionerCount > 0
                      ? `Yes (${commissionerCount})`
                      : "No"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {profile.isAdmin ? "Admin" : "Standard"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={setAdminStatus}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <input
                        type="hidden"
                        name="nextIsAdmin"
                        value={profile.isAdmin ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
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
    </div>
  );
}
