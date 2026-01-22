# Teams Dashboard QA Flow

1. Run `npm run dev` and open a browser at `http://localhost:3000/my-teams` while authenticated with a profile that owns or participates in at least two teams.
2. Confirm the compact list renders: each row should show a lineup state dot, league name, rank, and the most urgent deadline, and any row should be clickable.
3. Click a team row and verify the page now shows the full dashboard: the large Lineup Status card, Upcoming Deadlines list, Standings Snapshot, and Waiver Signals summary for that team.
4. If the lineup state is anything other than `SET`, the CTA should say “Set lineup” and the Lineup Status card should still show the matchweek label and lock time.
5. Switch teams using the header switcher (when more than one team is available) and confirm the dashboard updates without a full page reload.
6. Click “View team” to ensure it routes to the existing `/leagues/[leagueId]/team` roster view, keeping focus on the logged-in experience.
