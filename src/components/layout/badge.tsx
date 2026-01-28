type BadgeProps = {
  label: string;
  tone?: "neutral" | "accent";
};

export default function Badge({ label, tone = "neutral" }: BadgeProps) {
  const toneClasses =
    tone === "accent"
      ? "border-[var(--accent)] text-[var(--accent)]"
      : "border-[var(--border)] text-[var(--text-muted)]";

  return (
    <span
      className={`w-fit rounded-full border bg-[var(--surface2)] px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses}`}
    >
      {label}
    </span>
  );
}
