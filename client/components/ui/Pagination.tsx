"use client";

import { useMemo, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface PaginationProps {
  page: number;
  /** Total number of pages (1-based count). */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Total item count — shown in the status text when provided. */
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
  disabled?: boolean;
  /** Accessible name for the nav landmark. */
  label?: string;
}

/** Slice a client-side list for the current page (1-based). */
export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const safeSize = Math.max(1, pageSize);
  const start = (Math.max(1, page) - 1) * safeSize;
  return items.slice(start, start + safeSize);
}

/** Page count for a total item count (always ≥ 1 when total > 0). */
export function pageCountFor(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

function buildPageItems(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);
  if (left > 2) items.push("ellipsis");
  for (let p = left; p <= right; p++) items.push(p);
  if (right < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);
  return items;
}

function PageButton({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2.5 text-[13px] font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/35 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "cursor-pointer motion-reduce:transition-none",
        active
          ? "border-[var(--sky)] bg-[color-mix(in_oklab,var(--sky)_12%,white)] text-[var(--navy)]"
          : "border-line bg-white text-ink hover:border-[color-mix(in_oklab,var(--sky)_40%,var(--line))] hover:bg-[var(--light)]",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Custom pagination — prev/next, numbered pages with ellipsis, optional page size.
 * Matches Input/Button focus language (sky ring, rounded-xl, --line borders).
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 15, 20, 50],
  onPageSizeChange,
  className,
  disabled = false,
  label = "Pagination",
}: PaginationProps) {
  const safePageCount = Math.max(1, pageCount || 1);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  const items = useMemo(
    () => buildPageItems(safePage, safePageCount),
    [safePage, safePageCount],
  );

  if (safePageCount <= 1 && !onPageSizeChange) {
    if (totalItems != null && totalItems > 0) {
      return (
        <p className={cn("text-[12px] text-ink-faint", className)} aria-live="polite">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>
      );
    }
    return null;
  }

  const rangeLabel =
    totalItems != null && pageSize
      ? (() => {
          const from = (safePage - 1) * pageSize + 1;
          const to = Math.min(safePage * pageSize, totalItems);
          return `${from}–${to} of ${totalItems}`;
        })()
      : totalItems != null
        ? `${totalItems} total`
        : `Page ${safePage} of ${safePageCount}`;

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3",
        className,
      )}
    >
      <p className="text-[12px] text-ink-faint" aria-live="polite">
        {rangeLabel}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {onPageSizeChange && pageSize != null ? (
          <div
            className="mr-1 flex items-center gap-1"
            role="group"
            aria-label="Rows per page"
          >
            <span className="pr-1 text-[12px] text-ink-soft">Rows</span>
            {pageSizeOptions.map((n) => (
              <PageButton
                key={n}
                active={n === pageSize}
                disabled={disabled}
                aria-label={`${n} rows per page`}
                aria-pressed={n === pageSize}
                onClick={() => {
                  onPageSizeChange(n);
                  onPageChange(1);
                }}
                className="min-w-8 px-2"
              >
                {n}
              </PageButton>
            ))}
          </div>
        ) : null}

        <PageButton
          aria-label="Previous page"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Prev
        </PageButton>

        {items.map((item, i) =>
          item === "ellipsis" ? (
            <span
              key={`e-${i}`}
              className="inline-flex h-9 min-w-9 items-center justify-center text-[13px] text-ink-faint"
              aria-hidden
            >
              …
            </span>
          ) : (
            <PageButton
              key={item}
              active={item === safePage}
              aria-label={`Page ${item}`}
              aria-current={item === safePage ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPageChange(item)}
            >
              {item}
            </PageButton>
          ),
        )}

        <PageButton
          aria-label="Next page"
          disabled={disabled || safePage >= safePageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </PageButton>
      </div>
    </nav>
  );
}
