import type { ConciergeAction, ConciergeTrigger } from "@/lib/api/concierge.api";

export const CONCIERGE_TRIGGER_LABELS: Record<ConciergeTrigger, string> = {
  DELAY: "Flight delay",
  CANCELLED: "Cancelled itinerary",
  DISRUPTION: "Disruption (delay, cancel, or schedule change)",
  REBOOK_OPPORTUNITY: "Eligible rebooking opportunity",
};

export const CONCIERGE_ACTION_LABELS: Record<ConciergeAction, string> = {
  NOTIFY: "Notify me only",
  PREPARE_REBOOK: "Prepare a rebooking for my confirmation",
  AUTONOMOUS_REBOOK: "Prepare a quote automatically (never tickets)",
};

export function formatConciergeBudget(minor: number, currency = "PKR"): string {
  if (!Number.isFinite(minor)) return "—";
  return `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

export function conciergeStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "EXECUTED":
      return "Completed (quote or notification only)";
    case "PENDING_CONFIRMATION":
      return "Waiting for your confirmation";
    case "BLOCKED":
      return "Held — not executed";
    case "ESCALATED":
      return "Needs your review";
    case "SKIPPED":
      return "Threshold not met";
    case "FAILED":
      return "Could not complete safely";
    default:
      return status || "—";
  }
}
