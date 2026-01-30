"use client";

import React from "react";
import {
  POSITION_KEYS,
  POSITION_LABELS,
  type PositionKey,
} from "@/lib/lineup-positions";

export type { PositionKey };
export { POSITION_KEYS, POSITION_LABELS };

export type LineupPitchProps<Slot> = {
  startersByPosition: Record<PositionKey, Slot[]>;
  bench: Slot[];
  renderPitchSlot: (slot: Slot, index: number) => React.ReactNode;
  renderBenchSlot: (slot: Slot, index: number) => React.ReactNode;
  benchLabel?: string;
  benchDescription?: React.ReactNode;
  benchCountLabel?: (count: number) => React.ReactNode;
  errorMessage?: React.ReactNode;
  benchLayout?: "grid" | "scroll";
};

export default function LineupPitch<Slot>({
  startersByPosition,
  bench,
  renderPitchSlot,
  renderBenchSlot,
  benchLabel = "Bench",
  benchDescription,
  benchCountLabel,
  errorMessage,
  benchLayout = "grid",
}: LineupPitchProps<Slot>) {
  const benchCountContent =
    benchCountLabel?.(bench.length) ?? (
      <span className="rounded-full bg-emerald-950/10 px-3 py-1 text-xs font-semibold text-emerald-950">
        {bench.length} slots
      </span>
    );

  return (
    <div className="pitch-enter rounded-[32px] border border-emerald-950/20 bg-[linear-gradient(180deg,#1f5e2c_0%,#17401f_100%)] p-6 shadow-[0_20px_60px_rgba(4,33,18,0.25)]">
      <div className="relative min-h-[760px] max-h-[920px] w-full overflow-hidden rounded-[26px] border border-white/50">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08)_32px,rgba(255,255,255,0.02)_32px,rgba(255,255,255,0.02)_64px)]" />
        <div className="absolute inset-4 rounded-[22px] border-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
        <div className="absolute left-1/2 top-4 h-16 w-36 -translate-x-1/2 rounded-b-[18px] border-2 border-white/60" />
        <div className="absolute left-1/2 bottom-4 h-16 w-36 -translate-x-1/2 rounded-t-[18px] border-2 border-white/60" />
        <div className="relative z-10 grid h-full grid-rows-4 gap-6 px-4 py-6">
          {POSITION_KEYS.map((key) => {
            const rowSlots = startersByPosition[key] ?? [];
            const count = rowSlots.length;
            const computeX = (index: number) => {
              if (count === 0) return 50;
              const fraction = (index + 1) / (count + 1);
              return fraction * 100;
            };

            return (
              <div
                key={key}
                className="relative flex flex-col items-center justify-center gap-4"
              >
                <div className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                  {POSITION_LABELS[key]}
                </div>
                <div className="relative w-full">
                  {count > 0 ? (
                    <div className="relative h-44">
                      {rowSlots.map((slot, index) => {
                        const x = computeX(index);
                        return (
                          <div
                            key={`${key}-${index}`}
                            className="absolute top-1/2"
                            style={{
                              left: `${x}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            {renderPitchSlot(slot, index)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                        No starters
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 rounded-[26px] border border-white/40 bg-[linear-gradient(135deg,rgba(134,239,172,0.7),rgba(56,189,248,0.6))] p-5 shadow-[0_16px_40px_rgba(7,40,32,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-950">
              {benchLabel}
            </p>
            {benchDescription ? (
              <p className="text-xs text-emerald-900/80">{benchDescription}</p>
            ) : null}
          </div>
          {benchCountContent}
        </div>
        {benchLayout === "scroll" ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {bench.map((slot, index) => (
              <React.Fragment key={`bench-${index}`}>
                {renderBenchSlot(slot, index)}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {bench.map((slot, index) => (
              <React.Fragment key={`bench-${index}`}>
                {renderBenchSlot(slot, index)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
