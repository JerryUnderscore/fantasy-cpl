import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEasternDateTime } from "@/lib/time";
import {
  getClubAccentColor,
  getClubBadge,
  getClubDisplayName,
} from "@/lib/clubs";

type MatchParams = { matchId: string };

export const runtime = "nodejs";

export default async function MatchDetailPage({
  params,
}: {
  params: MatchParams;
}) {
  const { matchId } = params;
  if (!matchId) notFound();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeClub: { select: { name: true, shortName: true, slug: true } },
      awayClub: { select: { name: true, shortName: true, slug: true } },
    },
  });

  if (!match) notFound();

  const homeLabel = getClubDisplayName(match.homeClub.slug, match.homeClub.name);
  const awayLabel = getClubDisplayName(match.awayClub.slug, match.awayClub.name);
  const homeAccent = getClubAccentColor(match.homeClub.slug);
  const awayAccent = getClubAccentColor(match.awayClub.slug);
  const homeBadge = getClubBadge(match.homeClub.slug);
  const awayBadge = getClubBadge(match.awayClub.slug);
  const kickoffLabel = formatEasternDateTime(new Date(match.kickoffAt));

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-[0_25px_45px_rgba(1,2,12,0.65)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/schedule"
            className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] hover:underline"
          >
            ← Back to schedule
          </Link>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {match.status}
          </span>
        </div>
        <h1 className="text-3xl font-semibold text-[var(--text)]">
          {homeLabel} vs {awayLabel}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Kickoff: {kickoffLabel} ET
        </p>

        <div className="mt-10 grid gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6 md:grid-cols-3">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            {homeBadge ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={homeBadge}
                alt={`${homeLabel} badge`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold"
                style={{ borderColor: homeAccent }}
              >
                {homeLabel.charAt(0)}
              </div>
            )}
            <div className="text-sm font-semibold text-[var(--text)]">
              {homeLabel}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Home club</div>
            <div
              className="mt-2 h-2 w-24 rounded-full"
              style={{ backgroundColor: homeAccent }}
            />
          </div>

          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Match status
            </div>
            <div className="text-lg font-semibold text-[var(--text)]">
              {match.status}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Details coming soon
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 text-center">
            {awayBadge ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={awayBadge}
                alt={`${awayLabel} badge`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold"
                style={{ borderColor: awayAccent }}
              >
                {awayLabel.charAt(0)}
              </div>
            )}
            <div className="text-sm font-semibold text-[var(--text)]">
              {awayLabel}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Away club</div>
            <div
              className="mt-2 h-2 w-24 rounded-full"
              style={{ backgroundColor: awayAccent }}
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Match information and stats will land here soon.
        </div>
      </div>
    </div>
  );
}
