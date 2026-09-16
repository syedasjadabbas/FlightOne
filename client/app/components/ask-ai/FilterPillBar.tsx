"use client";

import type { FilterPill } from "@/lib/ask-ai/types";
import { isClientFilterableKind, pillRemovalRefinement } from "@/lib/ask-ai/pillRefinement";

export function FilterPillBar({
  pills,
  onTogglePill,
  onSendFilter,
}: {
  pills: FilterPill[];
  onTogglePill: (pillId: string) => void;
  /** Re-search when removing an NL pill that cannot be client-filtered. */
  onSendFilter?: (text: string) => void;
}) {
  if (pills.length === 0) return null;

  const visible = pills.filter((p) => p.active);
  if (visible.length === 0) return null;

  function handleClick(pill: FilterPill) {
    const wasActive = pill.active;

    if (
      wasActive &&
      pill.source === "nl" &&
      onSendFilter &&
      !isClientFilterableKind(pill.kind)
    ) {
      const refinement = pillRemovalRefinement(pill);
      if (refinement) onSendFilter(refinement);
    }

    onTogglePill(pill.id);
  }

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="toolbar"
      aria-label="Search filters"
    >
      {visible.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => handleClick(pill)}
          aria-pressed={pill.active}
          className="filter-pill results-summary-chip results-summary-chip--active inline-flex items-center gap-1"
        >
          <span className="text-[10px] opacity-80" aria-hidden>
            ×
          </span>
          {pill.label}
        </button>
      ))}
    </div>
  );
}
