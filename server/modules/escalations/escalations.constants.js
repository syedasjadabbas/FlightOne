/**
 * Module 13 — Human Agent Escalation domain constants.
 */

export const ESCALATION_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
];

/** Active statuses — duplicate create returns the existing ticket. */
export const ACTIVE_ESCALATION_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS"];

/**
 * Module 13 PRD triggers (primary) plus legacy aliases and adjacent-module
 * triggers used by journey/visa/pricing without inventing new PRD rules.
 */
export const ESCALATION_TRIGGERS = [
  "CUSTOMER_REQUEST",
  "VIP_BOOKING",
  "VIP",
  "COMPLEX_ITINERARY",
  "SUPPLIER_FAILURE",
  "REFUND_DISPUTE",
  "MEDICAL_ASSISTANCE",
  "MEDICAL",
  "SPECIAL_SERVICE_REQUEST",
  "SSR",
  "AI_DISCOUNT_LIMIT",
  "VISA_UNCERTAIN",
  "JOURNEY_DISRUPTION",
  "OTHER",
];

/** Default queue priority by trigger (higher = more urgent). */
export const DEFAULT_PRIORITY_BY_TRIGGER = Object.freeze({
  MEDICAL_ASSISTANCE: 3,
  MEDICAL: 3,
  JOURNEY_DISRUPTION: 3,
  VIP_BOOKING: 2,
  VIP: 2,
  SUPPLIER_FAILURE: 2,
  AI_DISCOUNT_LIMIT: 2,
  VISA_UNCERTAIN: 2,
  COMPLEX_ITINERARY: 1,
  REFUND_DISPUTE: 1,
  SPECIAL_SERVICE_REQUEST: 1,
  SSR: 1,
  CUSTOMER_REQUEST: 0,
  OTHER: 0,
});

/** Map legacy / short aliases onto PRD canonical trigger names. */
export function normalizeEscalationTrigger(trigger) {
  const t = String(trigger || "").trim().toUpperCase();
  if (t === "VIP") return "VIP_BOOKING";
  if (t === "MEDICAL") return "MEDICAL_ASSISTANCE";
  if (t === "SSR") return "SPECIAL_SERVICE_REQUEST";
  return t;
}
