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

export type SheetActionTone = "primary" | "secondary" | "danger" | "ghost";

export type SheetAction = {
  key: string;
  label: string;
  tone?: SheetActionTone;
  disabled?: boolean;
  loading?: boolean;
  autoClose?: boolean;
  onPress?: (ctx: SheetContextValue) => void | Promise<void>;
};

export type SheetConfig = {
  id: string;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "auto";
  dismissible?: boolean;
  blocking?: boolean;
  snapPoints?: number[];
  initialSnap?: number;
  render: (ctx: SheetContextValue) => React.ReactNode;
  actions?: SheetAction[];
};

export type SheetResult =
  | { type: "dismiss" }
  | { type: "action"; payload?: { key?: string; value?: unknown } }
  | { type: "data"; payload?: { value?: unknown } };

type SheetError = { message: string; disablePrimary?: boolean };

type SheetState = {
  config: SheetConfig | null;
  isOpen: boolean;
  error: SheetError | null;
  loading: boolean;
  actionLoadingKey: string | null;
};

type SheetContextValue = {
  open: (config: SheetConfig) => Promise<SheetResult>;
  replace: (config: SheetConfig) => Promise<SheetResult>;
  close: (result?: SheetResult) => void;
  isOpen: boolean;
  activeId: string | null;
  setLoading: (value: boolean) => void;
  setError: (message: string | null, disablePrimary?: boolean) => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

const sizeClasses: Record<NonNullable<SheetConfig["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  auto: "max-w-3xl",
};

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((result: SheetResult) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SheetState>({
    config: null,
    isOpen: false,
    error: null,
    loading: false,
    actionLoadingKey: null,
  });

  const close = useCallback((result?: SheetResult) => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      config: null,
      error: null,
      loading: false,
      actionLoadingKey: null,
    }));
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(result ?? { type: "dismiss" });
  }, []);

  const open = useCallback(
    (config: SheetConfig) => {
      if (resolverRef.current) {
        resolverRef.current({ type: "dismiss" });
      }
      setState({
        config,
        isOpen: true,
        error: null,
        loading: false,
        actionLoadingKey: null,
      });
      return new Promise<SheetResult>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [],
  );

  const replace = useCallback(
    (config: SheetConfig) => {
      if (resolverRef.current) {
        resolverRef.current({ type: "dismiss" });
      }
      setState({
        config,
        isOpen: true,
        error: null,
        loading: false,
        actionLoadingKey: null,
      });
      return new Promise<SheetResult>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [],
  );

  const setLoading = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, loading: value }));
  }, []);

  const setError = useCallback(
    (message: string | null, disablePrimary = true) => {
      setState((prev) => ({
        ...prev,
        error: message ? { message, disablePrimary } : null,
      }));
    },
    [],
  );

  const ctxValue = useMemo<SheetContextValue>(
    () => ({
      open,
      replace,
      close,
      isOpen: state.isOpen,
      activeId: state.config?.id ?? null,
      setLoading,
      setError,
    }),
    [open, replace, close, state.isOpen, state.config?.id, setLoading, setError],
  );

  const config = state.config;
  const dismissible = config?.dismissible ?? true;
  const blocking = config?.blocking ?? false;

  useScrollLock(state.isOpen);
  useRestoreFocus(state.isOpen, containerRef.current ?? undefined);

  const sheetHeight = (() => {
    if (!config) return undefined;
    const snap = config.snapPoints?.[config.initialSnap ?? 0];
    if (snap != null) return `${snap}vh`;
    return undefined;
  })();

  const handleActionPress = async (action: SheetAction) => {
    if (!config) return;
    const shouldAutoClose = action.autoClose !== false;
    try {
      if (action.onPress) {
        setState((prev) => ({ ...prev, actionLoadingKey: action.key }));
        await action.onPress(ctxValue);
      }
      if (shouldAutoClose) {
        close({ type: "action", payload: { key: action.key } });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setState((prev) => ({ ...prev, actionLoadingKey: null }));
    }
  };

  return (
    <SheetContext.Provider value={ctxValue}>
      {children}
      {state.isOpen && config ? (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <button
              type="button"
              aria-label="Close"
              disabled={!dismissible}
              onClick={() => (dismissible ? close() : null)}
              className={`absolute inset-0 bg-black/50 transition-opacity motion-reduce:transition-none ${
                blocking ? "cursor-default" : ""
              }`}
            />
            <div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              className={`relative w-full rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] px-5 pb-6 pt-4 shadow-2xl outline-none transition-transform motion-reduce:transition-none ${
                sizeClasses[config.size ?? "md"]
              }`}
              style={{ maxHeight: "92vh", height: sheetHeight }}
            >
              <FocusTrap active={state.isOpen} containerRef={containerRef} />
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  {config.title ? (
                    <h2 className="text-base font-semibold text-[var(--text)]">
                      {config.title}
                    </h2>
                  ) : null}
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
              {state.error ? (
                <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[rgba(242,100,100,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
                  {state.error.message}
                </div>
              ) : null}
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {config.render(ctxValue)}
              </div>
              {config.actions && config.actions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {config.actions.map((action) => {
                    const isPrimary = action.tone === "primary";
                    const shouldDisablePrimary =
                      isPrimary && state.error?.disablePrimary;
                    const disabled =
                      action.disabled ||
                      state.loading ||
                      state.actionLoadingKey === action.key ||
                      shouldDisablePrimary;
                    const toneClass = (() => {
                      switch (action.tone) {
                        case "primary":
                          return "bg-[var(--accent)] text-[var(--background)]";
                        case "danger":
                          return "bg-[var(--danger)] text-white";
                        case "ghost":
                          return "border border-transparent text-[var(--text-muted)]";
                        default:
                          return "border border-[var(--border)] text-[var(--text-muted)]";
                      }
                    })();
                    return (
                      <button
                        key={action.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleActionPress(action)}
                        className={`w-full rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${toneClass}`}
                      >
                        {action.loading || state.actionLoadingKey === action.key
                          ? "Working..."
                          : action.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </Portal>
      ) : null}
    </SheetContext.Provider>
  );
}

export function useSheet() {
  const ctx = useContext(SheetContext);
  if (!ctx) {
    throw new Error("useSheet must be used within a SheetProvider");
  }
  return ctx;
}
