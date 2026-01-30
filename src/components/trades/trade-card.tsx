"use client";

import { useMemo } from "react";
import LocalDateTime from "@/components/local-date-time";

export type TradeCardDirection = "INCOMING" | "OUTGOING" | "HISTORY";
export type TradeCardStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export type TradeItem = {
  id: string;
  name: string;
  position: string;
  clubName?: string | null;
  clubSlug?: string | null;
  badge?: string | null;
};

type TradeCardProps = {
  direction: TradeCardDirection;
  status: TradeCardStatus;
  title: string;
  subtext?: string;
  timestamp?: string | Date | null;
  secondaryTimestamp?: string;
  leftLabel?: string;
  rightLabel?: string;
  leftItems: TradeItem[];
  rightItems: TradeItem[];
  details?: string | null;
  statusLabel?: string;
  onAccept?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  onCounter?: () => void;
  isActing?: boolean;
  actionsDisabled?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  stacked?: boolean;
  stackedOrder?: "left-first" | "right-first";
};

const labelMap: Record<TradeCardDirection, [string, string]> = {
  INCOMING: ["You give", "You receive"],
  OUTGOING: ["You offered", "You requested"],
  HISTORY: ["You gave", "You received"],
};

export default function TradeCard({
  direction,
  status,
  title,
  subtext,
  timestamp,
  secondaryTimestamp,
  leftLabel,
  rightLabel,
  leftItems,
  rightItems,
  details,
  statusLabel,
  onAccept,
  onReject,
  onWithdraw,
  onCounter,
  isActing = false,
  actionsDisabled = false,
  collapsible = false,
  defaultCollapsed = false,
  stacked = false,
  stackedOrder = "left-first",
}: TradeCardProps) {
  const [defaultLeftLabel, defaultRightLabel] = labelMap[direction];
  const resolved = status !== "PENDING";
  const muted = direction === "HISTORY" || resolved;
  const computedStatusLabel = statusLabel ?? status;
  const shouldShowActions =
    !resolved &&
    (direction === "INCOMING" || direction === "OUTGOING") &&
    (onAccept || onReject || onWithdraw || onCounter);

  const handleWithdraw = () => {
    if (!onWithdraw) return;
    const confirmed = window.confirm("Withdraw this trade offer?");
    if (confirmed) onWithdraw();
  };

  const metaLabel = useMemo(() => {
    if (!timestamp) return null;
    return <LocalDateTime value={timestamp} fallback="Timestamp unavailable" />;
  }, [timestamp]);

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {title}
        </p>
        {subtext ? (
          <p className="text-sm font-semibold text-[var(--text)]">{subtext}</p>
        ) : null}
        {metaLabel || secondaryTimestamp ? (
          <p className="text-xs text-[var(--text-muted)]">
            {metaLabel}
            {secondaryTimestamp ? (
              <>
                {" "} - {secondaryTimestamp}
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {computedStatusLabel}
      </span>
    </div>
  );

  const itemsOrder =
    stackedOrder === "left-first" ? ["left", "right"] : ["right", "left"];

  const body = (
    <>
      <div className={`mt-4 grid gap-4 ${stacked ? "" : "md:grid-cols-2"}`}>
        {itemsOrder.map((side) => {
          const label =
            side === "left"
              ? leftLabel ?? defaultLeftLabel
              : rightLabel ?? defaultRightLabel;
          const items = side === "left" ? leftItems : rightItems;
          return (
            <div
              key={side}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {label}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
                {items.map((item) => (
                  <li key={item.id}>
                    <span className="break-words font-semibold text-[var(--text)]">
                      {item.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {" "} - {item.position}
                      {item.clubName ? ` - ${item.clubName}` : ""}
                    </span>
                    {item.badge ? (
                      <span className="ml-2 inline-flex rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {item.badge}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {details ? (
        <details className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Details
          </summary>
          <p className="mt-2 text-sm text-[var(--text)]">{details}</p>
        </details>
      ) : null}

      {shouldShowActions ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {direction === "INCOMING" && status === "PENDING" ? (
            <>
              {onAccept ? (
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={actionsDisabled || isActing}
                  className="w-full rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isActing ? "Working..." : "Accept"}
                </button>
              ) : null}
              {onReject ? (
                <button
                  type="button"
                  onClick={onReject}
                  disabled={actionsDisabled || isActing}
                  className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Reject
                </button>
              ) : null}
              {onCounter ? (
                <button
                  type="button"
                  onClick={onCounter}
                  disabled={actionsDisabled || isActing}
                  className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Counter
                </button>
              ) : null}
            </>
          ) : null}
          {direction === "OUTGOING" && status === "PENDING" ? (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={actionsDisabled || isActing}
              className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isActing ? "Working..." : "Withdraw"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const content = (
    <>
      {header}
      {body}
    </>
  );

  if (collapsible) {
    return (
      <details
        className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${
          muted ? "opacity-95" : ""
        }`}
        open={!defaultCollapsed}
      >
        <summary className="cursor-pointer list-none">{header}</summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${
        muted ? "opacity-95" : ""
      }`}
    >
      {content}
    </div>
  );
}
