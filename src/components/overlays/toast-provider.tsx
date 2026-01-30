"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Portal } from "./overlay-utils";

export type ToastTone = "success" | "info" | "error" | "undo";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  success: (message: string) => void;
  info: (message: string) => void;
  error: (message: string) => void;
  undo: (config: { message: string; actionLabel?: string; onAction?: () => void }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastTimeouts: Record<ToastTone, number> = {
  success: 2800,
  info: 3200,
  error: 5000,
  undo: 6000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timeout = toastTimeouts[toast.tone];
      timers.current[id] = window.setTimeout(() => {
        removeToast(id);
      }, timeout);
    },
    [removeToast],
  );

  const ctxValue = useMemo<ToastContextValue>(
    () => ({
      success: (message) => pushToast({ message, tone: "success" }),
      info: (message) => pushToast({ message, tone: "info" }),
      error: (message) => pushToast({ message, tone: "error" }),
      undo: ({ message, actionLabel, onAction }) =>
        pushToast({ message, tone: "undo", actionLabel, onAction }),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {toasts.length > 0 ? (
        <Portal>
          <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-6 sm:items-end">
            {toasts.map((toast) => {
              const toneClass = (() => {
                switch (toast.tone) {
                  case "success":
                    return "border-[var(--success)] text-[var(--success)]";
                  case "error":
                    return "border-[var(--danger)] text-[var(--danger)]";
                  case "undo":
                    return "border-[var(--accent)] text-[var(--accent)]";
                  default:
                    return "border-[var(--border)] text-[var(--text-muted)]";
                }
              })();
              return (
                <div
                  key={toast.id}
                  className={`flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border bg-[var(--surface)] px-4 py-3 text-sm shadow-lg ${toneClass}`}
                >
                  <span className="text-[var(--text)]">{toast.message}</span>
                  {toast.tone === "undo" && toast.onAction ? (
                    <button
                      type="button"
                      onClick={() => {
                        toast.onAction?.();
                        removeToast(toast.id);
                      }}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                    >
                      {toast.actionLabel ?? "Undo"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeToast(toast.id)}
                      className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Portal>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
