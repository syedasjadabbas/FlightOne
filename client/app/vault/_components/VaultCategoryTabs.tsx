"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clock,
  CreditCard,
  Files,
  Stamp,
  Ticket,
  UserRound,
} from "lucide-react";

export type VaultCategory =
  | "ALL"
  | "IDENTITIES"
  | "VISAS"
  | "LOYALTY"
  | "VOUCHERS"
  | "EXPIRING";

const CATEGORY_TABS: Array<{ id: VaultCategory; label: string; icon: LucideIcon }> = [
  { id: "ALL", label: "All Items", icon: Files },
  { id: "IDENTITIES", label: "Passports & IDs", icon: UserRound },
  { id: "VISAS", label: "Visas", icon: Stamp },
  { id: "LOYALTY", label: "Loyalty", icon: CreditCard },
  { id: "VOUCHERS", label: "Tickets & Vouchers", icon: Ticket },
  { id: "EXPIRING", label: "Expiring ≤90d", icon: Clock },
];

export function VaultCategoryTabs({
  selected,
  onChange,
}: {
  selected: VaultCategory;
  onChange: (id: VaultCategory) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Document categories"
      className="fo-vault__nav-tabs"
    >
      {CATEGORY_TABS.map((tab) => {
        const on = selected === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`vault-tab-${tab.id.toLowerCase()}`}
            aria-selected={on}
            aria-controls={`vault-panel-${tab.id.toLowerCase()}`}
            onClick={() => onChange(tab.id)}
            className={`fo-vault__tab-pill${on ? " fo-vault__tab-pill--active" : ""}`}
          >
            <Icon
              className="fo-vault__tab-icon"
              size={13}
              strokeWidth={on ? 2.2 : 1.75}
              aria-hidden
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
