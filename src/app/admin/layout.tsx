import { requireAdminUser } from "@/lib/admin";
import AdminNav from "@/components/admin/admin-nav";
import SectionCard from "@/components/layout/section-card";

export const runtime = "nodejs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60">
        <SectionCard title="Admin console">
          <AdminNav />
        </SectionCard>
      </aside>
      <section className="min-h-[70vh] flex-1">
        {children}
      </section>
    </div>
  );
}
