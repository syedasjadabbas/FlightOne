"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FilterPopover({
  open,
  title,
  onClose,
  onClear,
  onDone,
  children,
  returnFocusRef,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onClear?: () => void;
  onDone: () => void;
  children: ReactNode;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hadOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
      );
      focusable?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(focusTimer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      hadOpenRef.current = true;
      return;
    }
    if (hadOpenRef.current) {
      returnFocusRef?.current?.focus();
    }
  }, [open, returnFocusRef]);

  if (!open) return null;

  return (
    <div
      className="filter-popover-root filter-popover-root--enter"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="filter-popover-backdrop"
        aria-label="Close filter"
        onClick={onClose}
      />
      <div ref={panelRef} className="filter-popover-panel">
        <header className="filter-popover-head">
          <h2 className="filter-popover-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="filter-popover-close"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="filter-popover-body">{children}</div>
        <footer className="filter-popover-foot">
          {onClear ? (
            <button type="button" onClick={onClear} className="filter-popover-clear">
              Clear
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onDone} className="filter-popover-done">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
