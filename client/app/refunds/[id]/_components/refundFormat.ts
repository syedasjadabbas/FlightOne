import type { RefundCaseStatus } from "@/lib/api/refunds.api";

export function labelize(value: string) {
  return value.replaceAll("_", " ");
}

export function formatMinor(minor: number | undefined | null, currency?: string | null) {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)} ${currency || ""}`.trim();
}

export function statusTone(status: RefundCaseStatus): "default" | "warn" | "muted" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "SUBMITTED":
    case "PROCESSING":
    case "REQUIRES_HUMAN":
    case "ELIGIBLE":
    case "QUOTED":
      return "warn";
    default:
      return "muted";
  }
}

export function statusHeadline(status: RefundCaseStatus): string {
  switch (status) {
    case "COMPLETED":
      return "Refund completed";
    case "REQUIRES_HUMAN":
      return "Manual review";
    case "PROCESSING":
      return "Processing";
    case "SUBMITTED":
      return "Submitted";
    case "FAILED":
      return "Refund failed";
    case "REJECTED":
      return "Rejected";
    case "NOT_ELIGIBLE":
      return "Not eligible";
    case "ELIGIBLE":
      return "Eligible";
    case "QUOTED":
      return "Quoted";
    case "DRAFT":
      return "Draft";
    default:
      return labelize(status);
  }
}

export function statusCopy(status: RefundCaseStatus): string {
  switch (status) {
    case "COMPLETED":
      return "Refund completed after payment confirmation.";
    case "REQUIRES_HUMAN":
      return "Automation could not safely complete this refund. It is not a payout.";
    case "PROCESSING":
      return "Payment and supplier steps are in progress. This is not a completed payout yet.";
    case "SUBMITTED":
      return "Case submitted and awaiting processing.";
    case "FAILED":
      return "Processing stopped. Review the failure note below for next steps.";
    case "REJECTED":
      return "This refund request was rejected.";
    case "NOT_ELIGIBLE":
      return "This booking is not eligible for an automated refund.";
    case "ELIGIBLE":
    case "QUOTED":
      return "Figures below are a quote. Submit the case to start processing.";
    case "DRAFT":
      return "Draft case — not submitted and not a payout.";
    default:
      return "This case is not a completed payout unless status is COMPLETED and payment status confirms it.";
  }
}

export type StatusIconTone = "ok" | "wait" | "warn" | "default";

export function statusIconTone(status: RefundCaseStatus): StatusIconTone {
  switch (status) {
    case "COMPLETED":
      return "ok";
    case "REQUIRES_HUMAN":
    case "FAILED":
    case "REJECTED":
    case "NOT_ELIGIBLE":
      return "warn";
    case "PROCESSING":
    case "SUBMITTED":
    case "ELIGIBLE":
    case "QUOTED":
      return "wait";
    default:
      return "default";
  }
}
