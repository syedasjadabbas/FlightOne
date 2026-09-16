import type { OfferCardFlight } from "@/lib/consultant/types";
import type { BaggageAllowance, FareRulesSummary } from "@/lib/inventory/fareTypes";
import {
  BAGGAGE_UNAVAILABLE,
  FARE_RULES_UNAVAILABLE,
  formatBaggageAllowance,
  formatFareRulesSummary,
  sanitizeFareRuleText,
} from "@/lib/inventory/fareDisplay";

export function formatDurationLabel(minutes: number, style: "short" | "long" = "short"): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (style === "long") {
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} mins`;
  }
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}`;
}

export function stopsLabel(stops: number): string {
  if (stops <= 0) return "Direct";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function cabinLabel(cabin: OfferCardFlight["cabin"]): string {
  if (cabin === "business") return "Business Class";
  if (cabin === "premium") return "Premium Economy";
  return "Economy Class";
}

/** @deprecated Prefer BAGGAGE_UNAVAILABLE / FARE_RULES_UNAVAILABLE */
export const FARE_DETAIL_UNKNOWN = "Not confirmed";

export { BAGGAGE_UNAVAILABLE, FARE_RULES_UNAVAILABLE };

export function baggageAllowanceLabel(
  kg?: number,
  allowance?: BaggageAllowance,
): string {
  return formatBaggageAllowance(allowance, kg);
}

export function refundableFareLabel(
  refundable?: boolean,
  rules?: FareRulesSummary,
): string {
  const summary = formatFareRulesSummary(rules, refundable);
  if (summary !== FARE_RULES_UNAVAILABLE) {
    const cancellation = sanitizeFareRuleText(rules?.cancellation);
    if (cancellation) return cancellation;
    if (refundable === true) return "Refundable";
    if (refundable === false) return "Non-refundable";
    return summary.split(" · ")[0] ?? summary;
  }
  if (refundable == null) return FARE_RULES_UNAVAILABLE;
  return refundable ? "Refundable" : "Non-refundable";
}

export function refundableFareHint(
  refundable?: boolean,
  rules?: FareRulesSummary,
): string {
  if (rules?.changes || rules?.cancellation || rules?.refund) {
    return formatFareRulesSummary(rules, refundable);
  }
  if (refundable == null) {
    return "Fare rules unavailable from Travelport for this search result.";
  }
  return refundable
    ? "Eligible for refund per airline policy."
    : "Changes or refunds may incur airline fees.";
}

export function baggageAllowanceHint(
  kg?: number,
  allowance?: BaggageAllowance,
): string {
  const label = formatBaggageAllowance(allowance, kg);
  if (label === BAGGAGE_UNAVAILABLE) {
    return "Allowance not returned by Travelport for this fare.";
  }
  return "Baggage allowance from Travelport for this fare.";
}

export function formatDayLabel(isoDate?: string): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatLayover(minutes: number): string {
  return `${formatDurationLabel(minutes, "long")} layover`;
}
