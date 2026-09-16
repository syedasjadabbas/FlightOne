/**
 * Module 13 — unit tests for intent / complexity / supplier helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectEscalationIntentFromMessage,
  evaluateComplexItineraryFromBooking,
  evaluateSupplierFailureEscalation,
  getConfiguredVipRewardTiers,
} from "./escalations.detect.js";
import { normalizeEscalationTrigger } from "./escalations.validators.js";
import { HANDOFF_MODE, CONSULTANT_ACTION_TYPES } from "./escalations.writeback.js";

describe("Module 13 escalation detect (unit)", () => {
  it("normalizes legacy trigger aliases to PRD names", () => {
    assert.equal(normalizeEscalationTrigger("VIP"), "VIP_BOOKING");
    assert.equal(normalizeEscalationTrigger("MEDICAL"), "MEDICAL_ASSISTANCE");
    assert.equal(normalizeEscalationTrigger("SSR"), "SPECIAL_SERVICE_REQUEST");
    assert.equal(normalizeEscalationTrigger("CUSTOMER_REQUEST"), "CUSTOMER_REQUEST");
  });

  it("Ava intent patterns cover PRD customer triggers", () => {
    assert.equal(
      detectEscalationIntentFromMessage("I need a travel consultant"),
      "CUSTOMER_REQUEST",
    );
    assert.equal(
      detectEscalationIntentFromMessage("fit to fly medical assistance please"),
      "MEDICAL_ASSISTANCE",
    );
  });

  it("complex itinerary is deterministic from attributes", () => {
    const yes = evaluateComplexItineraryFromBooking({
      product: "FLIGHT",
      metadata: { tripType: "MULTI_CITY", segments: [1, 2, 3] },
    });
    assert.equal(yes.shouldEscalate, true);

    const no = evaluateComplexItineraryFromBooking({
      product: "FLIGHT",
      metadata: { tripType: "ROUND_TRIP", segments: [1, 2] },
    });
    assert.equal(no.shouldEscalate, false);
  });

  it("empty inventory is not supplier failure without HARD flag", () => {
    assert.equal(
      evaluateSupplierFailureEscalation({ message: "No fares" }).shouldEscalate,
      false,
    );
    assert.equal(
      evaluateSupplierFailureEscalation({ failureClass: "HARD" }).shouldEscalate,
      true,
    );
  });

  it("VIP tiers empty by default (no fabricated VIP)", () => {
    const prev = process.env.ESCALATION_VIP_REWARD_TIERS;
    delete process.env.ESCALATION_VIP_REWARD_TIERS;
    assert.deepEqual(getConfiguredVipRewardTiers(), []);
    if (prev !== undefined) process.env.ESCALATION_VIP_REWARD_TIERS = prev;
  });

  it("warm handoff is deferred; cold is the implemented mode", () => {
    assert.equal(HANDOFF_MODE.IMPLEMENTED, "COLD");
    assert.equal(HANDOFF_MODE.WARM_STATUS, "PRODUCT_DECISION_DEFERRED");
    assert.ok(CONSULTANT_ACTION_TYPES.includes("CANCEL_BOOKING"));
    assert.ok(CONSULTANT_ACTION_TYPES.includes("REFUND_PROCESS"));
    assert.ok(CONSULTANT_ACTION_TYPES.includes("JOURNEY_REBOOK_HANDOFF"));
  });
});
