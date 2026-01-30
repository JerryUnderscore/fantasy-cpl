"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const getFocusableElements = (root: HTMLElement | null) => {
  if (!root) return [] as HTMLElement[];
  const selector =
    "a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
  );
};

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isLocked]);
}

export function useRestoreFocus(isOpen: boolean, focusTarget?: HTMLElement | null) {
  const previousRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousRef.current = document.activeElement as HTMLElement | null;
      if (focusTarget) {
        focusTarget.focus();
      }
      return;
    }
    if (previousRef.current) {
      previousRef.current.focus();
      previousRef.current = null;
    }
  }, [isOpen, focusTarget]);
}

export function FocusTrap({
  active,
  containerRef,
}: {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    if (!active) return;
    const node = containerRef.current;
    if (!node) return;
    const focusable = getFocusableElements(node);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);

  return null;
}

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<Element | null>(null);

  useEffect(() => {
    portalRef.current = document.body;
    setMounted(true);
  }, []);

  if (!mounted || !portalRef.current) return null;
  return createPortal(children, portalRef.current);
}
