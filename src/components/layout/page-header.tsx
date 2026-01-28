type PageHeaderProps = {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
};

export default function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        {badge ? (
          <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {badge}
          </span>
        ) : null}
        <h1 className="text-3xl font-semibold text-[var(--text)]">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
