import type { ReactNode } from "react";
import Badge from "@/components/layout/badge";

type PageHeaderProps = {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        {badge ? <Badge label={badge} /> : null}
        <h1 className="text-3xl font-semibold text-[var(--text)]">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
