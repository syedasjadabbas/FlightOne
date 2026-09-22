"use client";

import type { ReactNode } from "react";

export type EscalationsTab = "knowledge" | "ticket" | "mycases";

const TABS: { id: EscalationsTab; label: string; needsAuth?: boolean }[] = [
  { id: "knowledge", label: "Knowledge" },
  { id: "ticket", label: "Open a case" },
  { id: "mycases", label: "My cases", needsAuth: true },
];

export function EscalationsTabs({
  active,
  onChange,
  signedIn,
  caseCount,
}: {
  active: EscalationsTab;
  onChange: (tab: EscalationsTab) => void;
  signedIn: boolean;
  caseCount: number;
}) {
  return (
    <div role="tablist" aria-label="Support sections" className="fo-escalations__tabs">
      {TABS.map((tab) => {
        if (tab.needsAuth && !signedIn) return null;
        const selected = active === tab.id;
        let label: ReactNode = tab.label;
        if (tab.id === "mycases") {
          label = (
            <>
              My cases
              <span className="ml-1 tabular-nums text-[var(--ink-faint)]">({caseCount})</span>
            </>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`escalations-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`escalations-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`fo-escalations__tab${selected ? " fo-escalations__tab--active" : ""}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
