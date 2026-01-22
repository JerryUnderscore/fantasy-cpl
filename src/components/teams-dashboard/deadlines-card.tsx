import type { DeadlineItem } from "./types";

type DeadlinesCardProps = {
  deadlines: DeadlineItem[];
};

const formatDateLabel = (iso: string | null) => {
  if (!iso) return "TBD";
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function DeadlinesCard({ deadlines }: DeadlinesCardProps) {
  const isEmpty = deadlines.length === 0;

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
          Upcoming deadlines
        </p>
        <span className="text-xs text-[var(--accent)]">Stay ahead</span>
      </div>
      {isEmpty ? (
        <p className="text-sm text-[var(--text-muted)]">No deadlines scheduled yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {deadlines.map((deadline) => (
            <article
              key={`${deadline.label}-${deadline.at ?? "tbd"}`}
              className="flex items-center justify-between border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-semibold text-white">{deadline.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{formatDateLabel(deadline.at)}</p>
              </div>
              <p className="text-sm font-semibold text-[var(--accent)]">
                {deadline.relativeText}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
