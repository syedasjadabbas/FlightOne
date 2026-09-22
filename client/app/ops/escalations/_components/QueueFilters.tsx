import type { EscalationStatus } from "@/lib/api/escalations.api";

export const STATUS_FILTERS: Array<{ value: EscalationStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const POOL_FILTERS: Array<{
  value: "ALL" | "VIP" | "MEDICAL" | "COMPLEX" | "GENERAL";
  label: string;
}> = [
  { value: "ALL", label: "All pools" },
  { value: "VIP", label: "VIP" },
  { value: "MEDICAL", label: "Medical" },
  { value: "COMPLEX", label: "Complex" },
  { value: "GENERAL", label: "General" },
];

export function QueueFilters({
  status,
  pool,
  onStatusChange,
  onPoolChange,
}: {
  status: EscalationStatus | "ALL";
  pool: (typeof POOL_FILTERS)[number]["value"];
  onStatusChange: (next: EscalationStatus | "ALL") => void;
  onPoolChange: (next: (typeof POOL_FILTERS)[number]["value"]) => void;
}) {
  return (
    <div className="fo-ops-eq__filters">
      <div>
        <p className="fo-ops-eq__filter-label" id="ops-eq-status-label">
          Status
        </p>
        <nav
          className="fo-ops__tabs"
          role="group"
          aria-labelledby="ops-eq-status-label"
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onStatusChange(f.value)}
              aria-pressed={status === f.value}
              className={`fo-ops__tab${status === f.value ? " fo-ops__tab--active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      </div>
      <div>
        <p className="fo-ops-eq__filter-label" id="ops-eq-pool-label">
          Pool
        </p>
        <nav className="fo-ops__tabs" role="group" aria-labelledby="ops-eq-pool-label">
          {POOL_FILTERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPoolChange(p.value)}
              aria-pressed={pool === p.value}
              className={`fo-ops__tab${pool === p.value ? " fo-ops__tab--active" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
