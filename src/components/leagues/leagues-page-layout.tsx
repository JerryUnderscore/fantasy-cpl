import type { MyLeagueViewModel, OpenLeagueViewModel } from "./types";
import LeagueRow from "./league-row";
import JoinLeaguePanel from "./join-league-panel";
import CreateLeaguePanel from "./create-league-panel";
import OpenLeaguesList from "./open-leagues-list";

type LeaguesPageLayoutProps = {
  myLeagues: MyLeagueViewModel[];
  openLeagues: OpenLeagueViewModel[];
};

export default function LeaguesPageLayout({
  myLeagues,
  openLeagues,
}: LeaguesPageLayoutProps) {
  const hasLeagues = myLeagues.length > 0;

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold text-white">Leagues</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Switch into a league quickly or start a new one.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Your leagues</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Primary hub
            </span>
          </div>
          {hasLeagues ? (
            <div className="flex flex-col gap-4">
              {myLeagues.map((league) => (
                <LeagueRow key={league.league.id} data={league} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface2)] p-8 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
                You’re not in any leagues yet
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Start by joining one</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Paste an invite code from a friend or create your own league.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <JoinLeaguePanel />
                <CreateLeaguePanel />
              </div>
            </div>
          )}
        </section>

        {hasLeagues && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--text-muted)]">
                Join / create
              </p>
              <span className="text-xs text-[var(--text-muted)]">Action section</span>
            </div>
            <JoinLeaguePanel />
            <CreateLeaguePanel />
          </section>
        )}
        <section className="flex flex-col gap-4">
          <OpenLeaguesList leagues={openLeagues} />
        </section>
      </div>
    </div>
  );
}
