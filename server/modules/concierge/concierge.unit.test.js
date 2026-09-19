import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  budgetAllows,
  eventMatchesTrigger,
  executionIdempotencyKey,
  thresholdMet,
} from "./concierge.match.js";

describe("concierge matching", () => {
  it("matches delay threshold and rejects below-threshold delays", () => {
    const rule = { trigger: "DELAY", thresholdMinutes: 120 };
    assert.equal(thresholdMet(rule, { eventType: "DELAY", minutesDelayed: 120 }), true);
    assert.equal(thresholdMet(rule, { eventType: "DELAY", minutesDelayed: 90 }), false);
    assert.equal(eventMatchesTrigger("CANCELLED", "DELAY"), false);
    assert.equal(eventMatchesTrigger("DISRUPTION", "CANCELLED"), true);
  });

  it("enforces authorised extra budget", () => {
    assert.equal(budgetAllows(2_000_000, 1_500_000), true);
    assert.equal(budgetAllows(2_000_000, 2_000_001), false);
  });

  it("builds a stable idempotency key per rule, booking, and event", () => {
    assert.equal(
      executionIdempotencyKey("r1", "b1", "delay-mins:150"),
      "concierge:r1:b1:delay-mins:150",
    );
  });
});
