/**
 * Checkout helpers for Module 08 visaCheck metadata (informational only).
 */

export type CheckoutVisaWarning = {
  show: boolean;
  severity: "info" | "caution";
  title: string;
  body: string;
  isFact: boolean;
  category: string | null;
  dataStatus: string | null;
  escalateRecommended: boolean;
};

/**
 * Derive a checkout warning from booking.metadata.visaCheck.
 * Never blocks checkout; never invents eligibility.
 */
export function visaWarningFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): CheckoutVisaWarning | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.visaCheck;
  if (!raw || typeof raw !== "object") return null;
  const check = raw as Record<string, unknown>;

  const category = typeof check.category === "string" ? check.category : null;
  const dataStatus = typeof check.dataStatus === "string" ? check.dataStatus : null;
  const isFact = check.isFact === true;
  const escalateRecommended = check.escalateRecommended === true;
  const missingInputs = Array.isArray(check.missingInputs)
    ? (check.missingInputs as string[])
    : [];

  // Silent when visa-free attributed fact — no concern to surface.
  if (isFact && category === "VISA_FREE" && !escalateRecommended) {
    return null;
  }

  // Incomplete inputs: soft info, not a block.
  if (dataStatus === "INCOMPLETE_INPUTS" || missingInputs.length > 0) {
    return {
      show: true,
      severity: "info",
      title: "Visa check incomplete",
      body: "Nationality or destination was missing for a full visa lookup. This does not block booking — add profile nationality and re-check on Visa if needed.",
      isFact: false,
      category,
      dataStatus: dataStatus || "INCOMPLETE_INPUTS",
      escalateRecommended: false,
    };
  }

  if (
    !isFact ||
    dataStatus === "STALE" ||
    dataStatus === "DATA_UNAVAILABLE" ||
    dataStatus === "UNCONFIGURED" ||
    category === "UNKNOWN" ||
    category === "EMBASSY" ||
    category === "E_VISA" ||
    category === "VOA" ||
    escalateRecommended
  ) {
    const factLabel = isFact ? "attributed catalog fact" : "guidance only — not a confirmed eligibility result";
    return {
      show: true,
      severity: isFact && category === "VISA_FREE" ? "info" : "caution",
      title: "Visa requirement notice",
      body: `Category ${category ?? "UNKNOWN"} (${dataStatus ?? "unknown"}). Treated as ${factLabel}. Booking is not blocked. Review /visa or ask a consultant if unsure.`,
      isFact,
      category,
      dataStatus,
      escalateRecommended,
    };
  }

  return null;
}
