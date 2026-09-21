"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clock,
  FileText,
  HeartHandshake,
  Settings2,
  Shield,
  Star,
  Users,
} from "lucide-react";

export type ProfileTab =
  | "PREFERENCES"
  | "COMPANIONS"
  | "EMERGENCY"
  | "LOYALTY"
  | "DOCUMENTS"
  | "SECURITY"
  | "HISTORY";

const TABS: Array<{ id: ProfileTab; label: string; icon: LucideIcon }> = [
  { id: "PREFERENCES", label: "Preferences", icon: Settings2 },
  { id: "COMPANIONS", label: "Companions", icon: Users },
  { id: "EMERGENCY", label: "Emergency", icon: HeartHandshake },
  { id: "LOYALTY", label: "Loyalty", icon: Star },
  { id: "DOCUMENTS", label: "Documents", icon: FileText },
  { id: "SECURITY", label: "Security", icon: Shield },
  { id: "HISTORY", label: "History", icon: Clock },
];

export function ProfileTabs({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="fo-profile__nav-tabs"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`profile-tab-${tab.id.toLowerCase()}`}
            aria-selected={selected}
            aria-controls={`profile-panel-${tab.id.toLowerCase()}`}
            onClick={() => onChange(tab.id)}
            className={`fo-profile__tab-pill${selected ? " fo-profile__tab-pill--active" : ""}`}
          >
            <Icon className="fo-profile__tab-icon" size={14} strokeWidth={selected ? 2.2 : 1.75} aria-hidden />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
