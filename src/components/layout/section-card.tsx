import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
  actions?: ReactNode;
};

export default function SectionCard({
  title,
  description,
  children,
  tone = "default",
  actions,
}: SectionCardProps) {
  const borderClass =
    tone === "danger" ? "border-[var(--danger)]" : "border-[var(--border)]";
  const backgroundClass =
    tone === "danger" ? "bg-[var(--surface2)]" : "bg-[var(--surface2)]";

  return (
    <section
      className={`rounded-2xl border ${borderClass} ${backgroundClass} p-4 shadow-sm sm:p-6`}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={title || description || actions ? "mt-4" : ""}>
        {children}
      </div>
    </section>
  );
}
