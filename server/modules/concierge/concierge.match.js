/**
 * Deterministic concierge rule matching — no provider I/O.
 */

export const TRIGGER_EVENT_TYPES = {
  DELAY: ["DELAY"],
  CANCELLED: ["CANCELLED"],
  DISRUPTION: ["DELAY", "CANCELLED", "GATE_CHANGE", "TERMINAL_CHANGE", "WEATHER", "MISSED_CONNECTION"],
  REBOOK_OPPORTUNITY: ["DELAY", "CANCELLED", "MISSED_CONNECTION"],
};

export function eventMatchesTrigger(trigger, eventType) {
  const allowed = TRIGGER_EVENT_TYPES[trigger] || [];
  return allowed.includes(eventType);
}

/**
 * Delay rules require minutesDelayed >= thresholdMinutes.
 * Cancelled/disruption without a delay threshold still match on event type.
 */
export function thresholdMet(rule, { eventType, minutesDelayed } = {}) {
  if (!eventMatchesTrigger(rule.trigger, eventType)) return false;
  if (eventType === "CANCELLED") return true;
  const threshold = Number.isInteger(rule.thresholdMinutes) ? rule.thresholdMinutes : null;
  if (threshold == null) return true;
  if (eventType !== "DELAY" && eventType !== "MISSED_CONNECTION") return true;
  const delayed = Number.isInteger(minutesDelayed) ? minutesDelayed : 0;
  return delayed >= threshold;
}

export function budgetAllows(maxAdditionalMinor, extraMinor) {
  const cap = Number.isInteger(maxAdditionalMinor) ? maxAdditionalMinor : 0;
  const extra = Number.isInteger(extraMinor) ? extraMinor : 0;
  if (extra < 0) return true;
  return extra <= cap;
}

export function executionIdempotencyKey(ruleId, bookingId, eventFingerprint) {
  return `concierge:${ruleId}:${bookingId}:${eventFingerprint || "event"}`;
}
