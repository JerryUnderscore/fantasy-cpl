import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Privacy" />
        <SectionCard>
          <div className="space-y-4 text-sm text-[var(--text-muted)]">
            <p>Fantasy CPL only collects the information needed to run the game.</p>
            <p>
              We use authentication details (such as your name, email address,
              and avatar) to identify your account and connect you to your teams
              and leagues. League activity, rosters, and results are stored so
              the game can function properly.
            </p>
            <p>
              Fantasy CPL does not sell your data, run ads, or share personal
              information with third parties.
            </p>
            <p>
              This is an independent, fan-run project built in good faith. If
              you ever have questions or concerns about your data, you’re
              welcome to reach out.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
