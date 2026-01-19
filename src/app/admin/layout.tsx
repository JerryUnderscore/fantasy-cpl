import { requireAdminUser } from "@/lib/admin";
import AdminNav from "@/components/admin/admin-nav";

export const runtime = "nodejs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Admin console
          </p>
          <AdminNav />
        </div>
      </aside>
      <section className="min-h-[70vh] flex-1 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {children}
      </section>
    </div>
  );
}
