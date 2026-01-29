import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Feedback" />
        <SectionCard>
          <div className="space-y-4 text-sm text-[var(--text-muted)]">
            <p>Fantasy CPL is a beta project, and feedback genuinely helps.</p>
            <p>
              If something feels confusing, broken, or just not quite right — or
              if you have an idea that would make the game better — I’d love to
              hear it.
            </p>
            <p>
              You can use feedback to report bugs, suggest improvements, or ask
              questions about how the game works.
            </p>
            <a
              href="mailto:wurnig@gmail.com"
              className="inline-flex items-center rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Email me
            </a>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
