import type { RefundCase, RefundCaseStatus } from "@/lib/api/refunds.api";

export const ACTIONABLE_STATUSES: RefundCaseStatus[] = [
  "SUBMITTED",
  "PROCESSING",
  "REQUIRES_HUMAN",
];

export const STATUS_FILTERS: Array<RefundCaseStatus | "ALL" | "ACTIONABLE"> = [
  "ACTIONABLE",
  "ALL",
  "SUBMITTED",
  "PROCESSING",
  "REQUIRES_HUMAN",
  "COMPLETED",
  "FAILED",
  "REJECTED",
];

export function kindLabel(kind: string | undefined) {
  return (kind || "REFUND").replaceAll("_", " ");
}

export function statusFilterLabel(filter: (typeof STATUS_FILTERS)[number]) {
  if (filter === "ALL") return "All";
  if (filter === "ACTIONABLE") return "Needs action";
  return filter.replaceAll("_", " ");
}

export function isActionable(status: RefundCaseStatus) {
  return ACTIONABLE_STATUSES.includes(status);
}

export function statusTone(status: string): "ok" | "warn" | "default" {
  if (status === "COMPLETED") return "ok";
  if (status === "REQUIRES_HUMAN" || status === "FAILED" || status === "NOT_ELIGIBLE") {
    return "warn";
  }
  return "default";
}

export function statusClass(status: string) {
  const tone = statusTone(status);
  if (tone === "ok") return "fo-desk__status fo-desk__status--ok";
  if (tone === "warn") return "fo-desk__status fo-desk__status--warn";
  return "fo-desk__status";
}

export function filterCases(
  items: RefundCase[],
  filter: (typeof STATUS_FILTERS)[number],
): RefundCase[] {
  if (filter === "ALL") return items;
  if (filter === "ACTIONABLE") return items.filter((c) => isActionable(c.status));
  return items.filter((c) => c.status === filter);
}

export function summarizeCases(items: RefundCase[]) {
  let actionable = 0;
  let requiresHuman = 0;
  let completed = 0;
  let failed = 0;

  for (const c of items) {
    if (isActionable(c.status)) actionable += 1;
    if (c.status === "REQUIRES_HUMAN") requiresHuman += 1;
    if (c.status === "COMPLETED") completed += 1;
    if (c.status === "FAILED") failed += 1;
  }

  return {
    total: items.length,
    actionable,
    requiresHuman,
    completed,
    failed,
  };
}

export function shortId(id: string, len = 10) {
  if (id.length <= len) return id;
  return `${id.slice(0, len)}…`;
}
