"use client";

export type VaultCategory =
  | "ALL"
  | "IDENTITIES"
  | "VISAS"
  | "LOYALTY"
  | "VOUCHERS"
  | "EXPIRING";

const CATEGORY_TABS: Array<{ id: VaultCategory; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "IDENTITIES", label: "Passports & IDs" },
  { id: "VISAS", label: "Visas" },
  { id: "LOYALTY", label: "Loyalty" },
  { id: "VOUCHERS", label: "Tickets & vouchers" },
  { id: "EXPIRING", label: "Expiring ≤90d" },
];

export function VaultCategoryTabs({
  selected,
  onChange,
}: {
  selected: VaultCategory;
  onChange: (id: VaultCategory) => void;
}) {
  return (
    <div role="tablist" aria-label="Document categories" className="fo-traveller__filters">
      {CATEGORY_TABS.map((tab) => {
        const on = selected === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={`fo-traveller__toggle${on ? " fo-traveller__toggle--on" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
