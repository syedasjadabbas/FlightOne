"use client";

import { ClipboardList, LayoutGrid } from "lucide-react";

type MiceTab = "enquiry" | "events";

export function MiceTabs({
  active,
  onChange,
  eventCount,
}: {
  active: MiceTab;
  onChange: (tab: MiceTab) => void;
  eventCount: number;
}) {
  return (
    <div className="fo-gm-tabs" role="tablist" aria-label="MICE desk sections">
      <button
        type="button"
        role="tab"
        aria-selected={active === "enquiry"}
        className={`fo-gm-tab${active === "enquiry" ? " fo-gm-tab--active" : ""}`}
        onClick={() => onChange("enquiry")}
      >
        <ClipboardList size={15} strokeWidth={2} aria-hidden />
        Event enquiry
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "events"}
        className={`fo-gm-tab${active === "events" ? " fo-gm-tab--active" : ""}`}
        onClick={() => onChange("events")}
      >
        <LayoutGrid size={15} strokeWidth={2} aria-hidden />
        Workspaces
        <span className="fo-gm-tab__count">{eventCount}</span>
      </button>
    </div>
  );
}
