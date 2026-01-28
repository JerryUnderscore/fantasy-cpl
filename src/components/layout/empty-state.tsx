import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryLink?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  primaryAction,
  secondaryLink,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6 text-sm text-[var(--text-muted)]">
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-[var(--text)]">{title}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      {primaryAction || secondaryLink ? (
        <div className="flex flex-wrap items-center gap-3">
          {primaryAction ?? null}
          {secondaryLink ?? null}
        </div>
      ) : null}
    </div>
  );
}
