import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_25px_45px_rgba(1,2,12,0.55)]">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] hover:underline"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Rules & Guidelines</h1>
          <p className="text-sm text-[var(--text-muted)]">
            The Fantasy CPL beta follows a unified rule set to keep every league aligned.
          </p>
        </div>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">League format</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Private leagues created by commissioners.</li>
              <li>Standard scoring across every league.</li>
              <li>Each league runs independently with its own schedule.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Player rosters</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Teams pick players via draft or free agency.</li>
              <li>Roster slots fill with starters and bench players.</li>
              <li>Switches after scoreboard lock count toward next matchweek.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Transactions</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Each week allows a limited number of transfers.</li>
              <li>Waiver windows reset after lineups lock.</li>
              <li>Trades are peer-to-peer with manual approval from both sides.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lineups & scoring</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Lineups lock at the kickoff of the first matchday in each week.</li>
              <li>Players added after lock sit on the bench until the next open week.</li>
              <li>Scoring is calculated once matches finalize their official stats.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
