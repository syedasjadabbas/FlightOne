import type { OfferCard } from "@/lib/consultant/types";
import type { BaggageAllowance, FareRulesSummary } from "./fareTypes";

export const BAGGAGE_UNAVAILABLE = "Baggage information unavailable";
export const FARE_RULES_UNAVAILABLE = "Fare rules unavailable";

/**
 * Coerce fare-rule fields to a displayable string.
 * Never returns "[object Object]" — objects without a text field yield null.
 */
export function sanitizeFareRuleText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const cleaned = value
      .replace(/\s*\(?\s*\[object Object\]\s*\)?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!cleaned || /^[:\-–—.,\s]+$/.test(cleaned)) return null;
    return cleaned;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["text", "message", "label", "description", "summary", "value"]) {
      const nested = sanitizeFareRuleText(o[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function ruleField(
  rules: FareRulesSummary | undefined,
  key: keyof FareRulesSummary,
): string | null {
  if (!rules) return null;
  return sanitizeFareRuleText(rules[key]);
}

export function formatBaggageAllowance(
  allowance?: BaggageAllowance,
  legacyKg?: number,
): string {
  const parts: string[] = [];

  if (allowance?.carryOn) {
    const c = allowance.carryOn;
    if (c.included) {
      parts.push(c.pieces ? `Carry-on ${c.pieces} piece` : "Carry-on included");
    } else if (c.text) {
      parts.push(`Carry-on: ${c.text}`);
    }
  }

  if (allowance?.checked) {
    const b = allowance.checked;
    if (b.included) {
      if (b.weightKg != null && b.weightKg > 0) {
        parts.push(`Checked ${b.weightKg}kg`);
      } else if (b.pieces) {
        parts.push(`Checked bag ${b.pieces} piece`);
      } else {
        parts.push("Checked bag included");
      }
    } else if (b.weightKg === 0 || b.included === false) {
      parts.push("Checked bag not included");
    } else if (b.text) {
      parts.push(b.text);
    }
  }

  if (parts.length === 0 && legacyKg != null && legacyKg > 0) {
    return `${legacyKg}kg checked`;
  }

  return parts.length ? parts.join(" · ") : BAGGAGE_UNAVAILABLE;
}

export function hasCheckedBaggageIncluded(
  allowance?: BaggageAllowance,
  legacyKg?: number,
): boolean {
  if (legacyKg != null && legacyKg >= 20) return true;
  const checked = allowance?.checked;
  if (!checked?.included) return false;
  if (checked.weightKg != null && checked.weightKg >= 20) return true;
  if ((checked.pieces ?? 0) > 0 && checked.weightKg !== 0) return true;
  return checked.included && checked.weightKg == null && (checked.pieces ?? 0) > 0;
}

export function formatFareRulesSummary(
  rules?: FareRulesSummary,
  refundable?: boolean,
): string {
  const lines: string[] = [];
  const changes = ruleField(rules, "changes");
  const cancellation = ruleField(rules, "cancellation");
  const refund = ruleField(rules, "refund");
  const noShow = ruleField(rules, "noShow");

  if (changes) {
    lines.push(changes.startsWith("Changes") ? changes : `Changes: ${changes}`);
  }
  if (cancellation) {
    lines.push(
      cancellation.startsWith("Cancel") || cancellation.startsWith("Non")
        ? cancellation
        : `Cancellation: ${cancellation}`,
    );
  } else if (refund) {
    lines.push(refund);
  } else if (refundable === true) {
    lines.push("Refundable");
  } else if (refundable === false) {
    lines.push("Non-refundable");
  }
  if (noShow) lines.push(`No-show: ${noShow}`);
  return lines.length ? lines.join(" · ") : FARE_RULES_UNAVAILABLE;
}

/** Safe per-field labels for fare summary UI rows. */
export function fareRuleRows(
  rules?: FareRulesSummary,
  refundable?: boolean,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const changes = ruleField(rules, "changes");
  const cancellation = ruleField(rules, "cancellation");
  const refund = ruleField(rules, "refund");
  const noShow = ruleField(rules, "noShow");

  if (changes) rows.push({ label: "Changes", value: changes });
  if (cancellation) {
    rows.push({ label: "Cancellation", value: cancellation });
  } else if (refund) {
    rows.push({ label: "Refund", value: refund });
  } else if (refundable === true) {
    rows.push({ label: "Cancellation / refund", value: "Refundable" });
  } else if (refundable === false) {
    rows.push({ label: "Cancellation / refund", value: "Non-refundable" });
  }
  if (noShow) rows.push({ label: "No-show", value: noShow });
  return rows;
}

export function fareFamilyLabel(brandName?: string, cabin?: string): string | null {
  if (brandName?.trim()) return brandName.trim();
  return null;
}

export function formatSupplierPriceBreakdown(
  breakdown: NonNullable<OfferCard["flight"]>["supplierPriceBreakdown"],
  locale = "en-PK",
): string[] {
  if (!breakdown) return [];
  const fmt = (minor: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: breakdown.currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);

  const lines: string[] = [];
  if (breakdown.baseMinor != null) lines.push(`Base ${fmt(breakdown.baseMinor)}`);
  if (breakdown.taxesMinor != null) lines.push(`Taxes ${fmt(breakdown.taxesMinor)}`);
  if (breakdown.feesMinor != null && breakdown.feesMinor > 0) {
    lines.push(`Fees ${fmt(breakdown.feesMinor)}`);
  }
  lines.push(`Supplier total ${fmt(breakdown.totalMinor)}`);
  return lines;
}

export function describeFareDifferences(a: OfferCard, b: OfferCard): string[] {
  const diffs: string[] = [];
  if (a.priceMinor !== b.priceMinor) {
    diffs.push(`Price: ${a.price} vs ${b.price}`);
  }
  const fa = a.flight;
  const fb = b.flight;
  if (!fa || !fb) return diffs;

  const brandA = fa.fareBrandName ?? fa.cabin;
  const brandB = fb.fareBrandName ?? fb.cabin;
  if (brandA !== brandB) diffs.push(`Fare: ${brandA} vs ${brandB}`);

  const bagA = formatBaggageAllowance(fa.baggageAllowance, fa.baggageKg);
  const bagB = formatBaggageAllowance(fb.baggageAllowance, fb.baggageKg);
  if (bagA !== bagB) diffs.push(`Baggage: ${bagA} vs ${bagB}`);

  const rulesA = formatFareRulesSummary(fa.fareRulesSummary, fa.refundable);
  const rulesB = formatFareRulesSummary(fb.fareRulesSummary, fb.refundable);
  if (rulesA !== rulesB) diffs.push(`Rules: ${rulesA} vs ${rulesB}`);

  return diffs;
}
