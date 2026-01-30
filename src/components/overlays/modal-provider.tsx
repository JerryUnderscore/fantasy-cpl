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

export type ModalAction = {
  key: string;
  label: string;
  tone?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onPress?: (ctx: ModalContextValue) => void | Promise<void>;
};

export type ModalConfig = {
  id: string;
  title: string;
  subtitle?: string;
  dismissible?: boolean;
  render: (ctx: ModalContextValue) => React.ReactNode;
  footer?: {
    leftAction?: ModalAction;
    rightAction?: ModalAction;
  };
};

export type ModalResult =
  | { type: "dismiss" }
  | { type: "submit"; payload?: unknown };

type ModalState = {
  config: ModalConfig | null;
  isOpen: boolean;
  loading: boolean;
};

type ModalContextValue = {
  open: (config: ModalConfig) => Promise<ModalResult>;
  close: (result?: ModalResult) => void;
  isOpen: boolean;
  activeId: string | null;
  setLoading: (value: boolean) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((result: ModalResult) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ModalState>({
    config: null,
    isOpen: false,
    loading: false,
  });

  const close = useCallback((result?: ModalResult) => {
    setState((prev) => ({ ...prev, isOpen: false, config: null, loading: false }));
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(result ?? { type: "dismiss" });
  }, []);

  const open = useCallback((config: ModalConfig) => {
    if (resolverRef.current) {
      resolverRef.current({ type: "dismiss" });
    }
    setState({ config, isOpen: true, loading: false });
    return new Promise<ModalResult>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const setLoading = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, loading: value }));
  }, []);

  const ctxValue = useMemo<ModalContextValue>(
    () => ({
      open,
      close,
      isOpen: state.isOpen,
      activeId: state.config?.id ?? null,
      setLoading,
    }),
    [open, close, state.isOpen, state.config?.id, setLoading],
  );

  const config = state.config;
  const dismissible = config?.dismissible ?? true;

  useScrollLock(state.isOpen);
  useRestoreFocus(state.isOpen, containerRef.current ?? undefined);

  const handleAction = async (action?: ModalAction) => {
    if (!action) return;
    try {
      setLoading(true);
      await action.onPress?.(ctxValue);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalContext.Provider value={ctxValue}>
      {children}
      {state.isOpen && config ? (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 px-4 py-6 sm:items-center">
            <div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl outline-none sm:h-[90vh]"
            >
              <FocusTrap active={state.isOpen} containerRef={containerRef} />
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    {config.title}
                  </h2>
                  {config.subtitle ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      {config.subtitle}
                    </p>
                  ) : null}
                </div>
                {dismissible ? (
                  <button
                    type="button"
                    onClick={() => close()}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                  >
                    Close
                  </button>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {config.render(ctxValue)}
              </div>
              {config.footer ? (
                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                  {config.footer.leftAction ? (
                    <button
                      type="button"
                      onClick={() => handleAction(config.footer?.leftAction)}
                      disabled={state.loading || config.footer.leftAction.disabled}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] disabled:opacity-60"
                    >
                      {config.footer.leftAction.label}
                    </button>
                  ) : (
                    <span />
                  )}
                  {config.footer.rightAction ? (
                    <button
                      type="button"
                      onClick={() => handleAction(config.footer?.rightAction)}
                      disabled={state.loading || config.footer.rightAction.disabled}
                      className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--background)] disabled:opacity-60"
                    >
                      {config.footer.rightAction.label}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Portal>
      ) : null}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
}
