import type { ReactNode } from "react";

type ErrorCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function ErrorCard({ title, description, action }: ErrorCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6 text-sm text-[var(--text-muted)]">
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
