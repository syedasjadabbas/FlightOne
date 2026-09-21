"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/utils/cn";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  hint?: string;
  error?: string;
  /** Show a clear control when a value is selected. */
  clearable?: boolean;
  /** When false, opens as a plain list (no typeahead field). Default true. */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  emptyMessage?: string;
  /** Compact trigger for dense toolbars. */
  size?: "md" | "sm";
}

function filterOptions(options: SearchableSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn(
        "h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-150",
        "motion-reduce:transition-none",
        open && "rotate-180",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/**
 * Accessible combobox with typeahead — FlightOne tokens, no Radix.
 * Matches Input styling: rounded-2xl, sky focus ring, tracking on labels.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  hint,
  error,
  clearable = false,
  searchable = true,
  disabled = false,
  id,
  className,
  emptyMessage = "No matches",
  size = "md",
}: SearchableSelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const selected = options.find((o) => o.value === value);
  const filtered = filterOptions(options, searchable ? query : "");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    const visible = filterOptions(options, "");
    const idx = visible.findIndex((o) => o.value === value && !o.disabled);
    setActiveIndex(idx >= 0 ? idx : visible.findIndex((o) => !o.disabled));
  }, [disabled, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open || !searchable) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, searchable]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const pick = (opt: SearchableSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  const clear = () => {
    onChange("");
    close();
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number) => {
    if (!filtered.length) return;
    let next = activeIndex;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (e.key === "ArrowDown") moveActive(1);
      else if (e.key === "ArrowUp") moveActive(-1);
      else if (e.key === "Enter" || e.key === " ") {
        const opt = filtered[activeIndex];
        if (opt) pick(opt);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  const describedBy = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className="cursor-pointer text-[12px] font-semibold tracking-wide text-ink-soft uppercase"
        >
          {label}
        </label>
      ) : null}

      <div className="relative flex items-stretch gap-1.5">
        <button
          ref={triggerRef}
          type="button"
          id={fieldId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${fieldId}-opt-${activeIndex}` : undefined
          }
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border bg-white/95 text-left text-ink outline-none transition-all duration-150",
            "shadow-[0_1px_3px_rgba(14,22,32,0.03),inset_0_1px_0_#ffffff]",
            "focus-visible:ring-4 focus-visible:ring-sky/15 focus-visible:border-sky focus-visible:bg-white focus-visible:shadow-[0_4px_14px_-2px_rgba(8,150,191,0.12)]",
            size === "sm" ? "rounded-xl px-3 py-2 text-[13px]" : "rounded-2xl px-4 py-2.5 text-[14px]",
            error
              ? "border-danger/60 focus-visible:border-danger focus-visible:ring-danger/15"
              : "border-black/10 hover:border-black/20",
            disabled ? "cursor-not-allowed opacity-50 hover:border-black/10" : null,
            open && !error && "border-sky ring-4 ring-sky/15 bg-white",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate leading-relaxed font-normal",
              !selected && "text-ink-faint/75",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronIcon open={open} />
        </button>

        {clearable && value && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className={cn(
              "inline-flex shrink-0 items-center justify-center border border-black/10 bg-white/95 text-ink-faint transition-all hover:border-black/20 hover:text-ink active:scale-95",
              size === "sm" ? "h-auto w-8 rounded-xl" : "w-11 rounded-2xl",
            )}
          >
            <ClearIcon />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fo-select-menu absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl shadow-[0_16px_36px_-8px_rgba(14,22,32,0.16)]"
        >
          {searchable ? (
            <div className="border-b border-black/6 p-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                className={cn(
                  "w-full rounded-xl border border-black/8 bg-[#f7f9fa] px-3 py-1.5 text-[13px] text-ink outline-none",
                  "placeholder:text-ink-faint",
                  "focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky/30 focus-visible:bg-white",
                )}
              />
            </div>
          ) : null}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={fieldId}
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2.5 text-[13px] text-ink-faint">{emptyMessage}</li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={opt.value || `empty-${idx}`}
                    id={`${fieldId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-idx={idx}
                    onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2 text-[13.5px] transition-colors",
                      opt.disabled
                        ? "cursor-not-allowed opacity-40"
                        : isActive
                          ? "bg-black/5 text-[#0e1620] font-medium"
                          : "text-[#55606e]",
                      isSelected && "font-semibold text-sky bg-sky/8",
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected ? (
                      <span className="text-sky text-xs font-bold">✓</span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={`${fieldId}-error`} className="text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-[11.5px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
