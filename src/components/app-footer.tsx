import Link from "next/link";
import { clickableRow } from "@/components/layout/ui-interactions";

export default function AppFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface2)]">
      <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-4 px-6 py-4 text-xs text-[var(--text-muted)]">
        <p>
          Fantasy CPL is an independent fan project and is not affiliated with,
          endorsed by, or sponsored by the Canadian Premier League or any of its
          clubs. All trademarks are the property of their respective owners.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 Fantasy CPL</span>
          <nav aria-label="Footer">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/rules"
                className={`${clickableRow} rounded-full px-3 py-1`}
              >
                Rules
              </Link>
              <Link
                href="/privacy"
                className={`${clickableRow} rounded-full px-3 py-1`}
              >
                Privacy
              </Link>
              <Link
                href="/feedback"
                className={`${clickableRow} rounded-full px-3 py-1`}
              >
                Feedback
              </Link>
              <a
                href="https://cplcontracts.ca"
                target="_blank"
                rel="noreferrer noopener"
                className={`${clickableRow} rounded-full px-3 py-1`}
              >
                CPLContracts.ca
              </a>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
