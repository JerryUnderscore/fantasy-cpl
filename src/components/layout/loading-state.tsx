type LoadingStateProps = {
  label?: string;
};

export default function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-sm text-[var(--text-muted)]">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
      <span>{label}</span>
    </div>
  );
}
