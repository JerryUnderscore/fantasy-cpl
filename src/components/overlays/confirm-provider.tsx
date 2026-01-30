"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { FocusTrap, Portal, useRestoreFocus, useScrollLock } from "./overlay-utils";

export type ConfirmConfig = {
  title: string;
  body: string;
  tone?: "danger" | "neutral";
  confirmLabel?: string;
  cancelLabel?: string;
  requireText?: string;
  requireTextHint?: string;
};

type ConfirmState = {
  config: ConfirmConfig | null;
  isOpen: boolean;
  inputValue: string;
};

type ConfirmContextValue = {
  ask: (config: ConfirmConfig) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ConfirmState>({
    config: null,
    isOpen: false,
    inputValue: "",
  });

  const close = useCallback((value: boolean) => {
    setState({ config: null, isOpen: false, inputValue: "" });
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(value);
  }, []);

  const ask = useCallback((config: ConfirmConfig) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }
    setState({ config, isOpen: true, inputValue: "" });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const ctxValue = useMemo(() => ({ ask }), [ask]);

  const config = state.config;
  const requiresText = Boolean(config?.requireText);
  const matchesRequirement =
    !requiresText || state.inputValue === config?.requireText;

  useScrollLock(state.isOpen);
  useRestoreFocus(state.isOpen, containerRef.current ?? undefined);

  return (
    <ConfirmContext.Provider value={ctxValue}>
      {children}
      {state.isOpen && config ? (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            >
              <FocusTrap active={state.isOpen} containerRef={containerRef} />
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {config.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {config.body}
              </p>
              {requiresText ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {config.requireTextHint ??
                      `Type "${config.requireText}" to confirm`}
                  </p>
                  <input
                    value={state.inputValue}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        inputValue: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:w-auto"
                >
                  {config.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={!matchesRequirement}
                  onClick={() => close(true)}
                  className={`w-full rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:opacity-60 sm:w-auto ${
                    config.tone === "danger"
                      ? "bg-[var(--danger)]"
                      : "bg-[var(--accent)] text-[var(--background)]"
                  }`}
                >
                  {config.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
