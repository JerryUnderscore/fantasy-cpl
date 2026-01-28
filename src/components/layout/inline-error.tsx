import type { ReactNode } from "react";

type InlineErrorProps = {
  message: string;
  action?: ReactNode;
};

export default function InlineError({ message, action }: InlineErrorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text-muted)]">
      <span>{message}</span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
