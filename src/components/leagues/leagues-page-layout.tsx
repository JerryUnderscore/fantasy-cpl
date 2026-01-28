import type { MyLeagueViewModel, OpenLeagueViewModel } from "./types";
import LeagueRow from "./league-row";
import JoinLeaguePanel from "./join-league-panel";
import CreateLeaguePanel from "./create-league-panel";
import OpenLeaguesList from "./open-leagues-list";
import PageHeader from "@/components/layout/page-header";
import SectionCard from "@/components/layout/section-card";
import EmptyState from "@/components/layout/empty-state";

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
        <PageHeader
          title="Leagues"
          subtitle="Switch into a league quickly or start a new one."
        />

        <SectionCard title="Your leagues" description="Your active leagues and standings.">
          {hasLeagues ? (
            <div className="flex flex-col gap-4">
              {myLeagues.map((league) => (
                <LeagueRow key={league.league.id} data={league} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No leagues yet"
              description="Paste an invite code from a friend or create your own league."
              primaryAction={<JoinLeaguePanel />}
              secondaryLink={<CreateLeaguePanel />}
            />
          )}
        </SectionCard>

        {hasLeagues ? (
          <SectionCard title="Join or create" description="Add another league.">
            <div className="flex flex-col gap-3">
              <JoinLeaguePanel />
              <CreateLeaguePanel />
            </div>
          </SectionCard>
        ) : null}

        <OpenLeaguesList leagues={openLeagues} />
      </div>
    </div>
  );
}
