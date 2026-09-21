export function formatMinor(minor: number | undefined, currency?: string) {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)} ${currency || ""}`.trim();
}

export function statusTone(status: string): "default" | "warn" | "muted" {
  switch (status) {
    case "COMPLETED":
    case "REFUNDED":
    case "APPROVED":
      return "default";
    case "SUBMITTED":
    case "PROCESSING":
    case "REQUIRES_HUMAN":
    case "ELIGIBLE":
      return "warn";
    default:
      return "muted";
  }
}

export function kindLabel(kind: string | undefined) {
  return (kind || "REFUND").replaceAll("_", " ");
}

export type EligibilityPreview = {
  dataStatus?: string;
  refundableMinor?: number;
  supplierPenaltyMinor?: number;
  agencyFeeMinor?: number;
  travelCreditMinor?: number;
  processingTimelineStatus?: string;
  processingTimelineNote?: string | null;
  confirmed?: boolean;
  formula?: { rule?: string };
};
