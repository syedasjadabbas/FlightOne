/**
 * Module 14 — refund calculation unit tests (fail-closed).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeExchangeAmounts,
  computeRefundAmounts,
  resolveAgencyFeeMinor,
  resolveSupplierPenaltyMinor,
} from "./refunds.calc.js";

describe("Module 14 refund calc (unit)", () => {
  it("non-refundable fare → full penalty, zero refund", () => {
    const r = computeRefundAmounts(10000, { refundable: false });
    assert.equal(r.refundableMinor, 0);
    assert.equal(r.supplierPenaltyMinor, 10000);
    assert.equal(r.dataStatus, "OK");
    assert.equal(r.formula.rule, "NON_REFUNDABLE_FARE");
  });

  it("does not invent default 10% penalty when rules lack amounts", () => {
    const r = computeRefundAmounts(10000, {});
    assert.equal(r.dataStatus, "DATA_UNAVAILABLE");
    assert.equal(r.refundableMinor, 0);
    assert.equal(r.formula.rule, "PENALTY_DATA_UNAVAILABLE");
  });

  it("uses authoritative penaltyBps + configured agency fee", () => {
    const r = computeRefundAmounts(
      10000,
      { refundable: true, penaltyBps: 1000 },
      { pricingAgencyFeeBps: 0 },
    );
    assert.equal(r.supplierPenaltyMinor, 1000);
    assert.equal(r.agencyFeeMinor, 0);
    assert.equal(r.refundableMinor, 9000);
    assert.equal(r.dataStatus, "OK");
  });

  it("hotel free-cancel before deadline → zero penalty", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const r = computeRefundAmounts(
      20000,
      { refundable: true, freeCancelUntil: future },
      { pricingAgencyFeeBps: 0, now: new Date() },
    );
    assert.equal(r.supplierPenaltyMinor, 0);
    assert.equal(r.refundableMinor, 20000);
    assert.equal(r.dataStatus, "OK");
  });

  it("schedule-change attributed → zero supplier penalty", () => {
    const r = computeRefundAmounts(
      10000,
      { refundable: true },
      { scheduleChangeAttributed: true, pricingAgencyFeeBps: 0 },
    );
    assert.equal(r.supplierPenaltyMinor, 0);
    assert.equal(r.refundableMinor, 10000);
    assert.equal(r.formula.rule, "AIRLINE_SCHEDULE_CHANGE");
  });

  it("partial refund scales basis", () => {
    const r = computeRefundAmounts(
      10000,
      { refundable: true, penaltyMinor: 0 },
      { partialRatio: 0.5, pricingAgencyFeeBps: 0 },
    );
    assert.equal(r.refundableMinor, 5000);
  });

  it("travel credit only when amount authoritative", () => {
    const r = computeRefundAmounts(10000, {
      refundable: false,
      travelCreditEligible: true,
      travelCreditMinor: 2500,
    });
    // non-refundable path zeros travel credit in current formula — credit on separate path
    assert.equal(r.formula.rule, "NON_REFUNDABLE_FARE");
    const credit = computeRefundAmounts(10000, {
      refundable: true,
      penaltyMinor: 10000,
      travelCreditEligible: true,
      travelCreditMinor: 2500,
    }, { pricingAgencyFeeBps: 0 });
    assert.equal(credit.travelCreditMinor, 2500);
  });

  it("processing timeline unavailable unless provided", () => {
    const r = computeRefundAmounts(10000, { refundable: true, penaltyMinor: 0 }, { pricingAgencyFeeBps: 0 });
    assert.equal(r.processingTimelineStatus, "DATA_UNAVAILABLE");
    const withTl = computeRefundAmounts(
      10000,
      { refundable: true, penaltyMinor: 0, processingTimelineDays: 7 },
      { pricingAgencyFeeBps: 0 },
    );
    assert.equal(withTl.processingTimelineStatus, "OK");
  });

  it("agency fee unavailable when not configured", () => {
    const fee = resolveAgencyFeeMinor(10000, {});
    assert.equal(fee.agencyFeeStatus, "DATA_UNAVAILABLE");
    assert.equal(fee.agencyFeeMinor, 0);
  });

  it("exchange fails closed without change fee / new fare", () => {
    const noFee = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeAllowed: true },
      newFareMinor: 12000,
    });
    assert.equal(noFee.dataStatus, "DATA_UNAVAILABLE");

    const noNew = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 500 },
    });
    assert.equal(noNew.dataStatus, "DATA_UNAVAILABLE");

    const ok = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 500 },
      newFareMinor: 12000,
      pricingAgencyFeeBps: 0,
    });
    assert.equal(ok.dataStatus, "OK");
    assert.equal(ok.fareDifferenceMinor, 2000);
    assert.equal(ok.changePenaltyMinor, 500);
    assert.equal(ok.agencyFeeMinor, 0);
    assert.equal(ok.customerDueMinor, 2500);
    assert.equal(ok.formula.liveGdsMutation, false);
  });

  it("exchange fare difference / penalty / agency fee math", () => {
    const higher = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 250, agencyFeeMinor: 100 },
      newFareMinor: 13000,
    });
    assert.equal(higher.dataStatus, "OK");
    assert.equal(higher.fareDifferenceMinor, 3000);
    assert.equal(higher.changePenaltyMinor, 250);
    assert.equal(higher.agencyFeeMinor, 100);
    assert.equal(higher.customerDueMinor, 3350);

    const lower = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 200, agencyFeeBps: 100 },
      newFareMinor: 8000,
    });
    // fareDiff -2000; residual = 2000 - 200 - 100 = 1700 refund
    assert.equal(lower.fareDifferenceMinor, -2000);
    assert.equal(lower.agencyFeeMinor, 100);
    assert.equal(lower.customerRefundMinor, 1700);
    assert.equal(lower.customerDueMinor, 0);
  });

  it("exchange processing timeline from fare rules only", () => {
    const missing = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 0 },
      newFareMinor: 10000,
      pricingAgencyFeeBps: 0,
    });
    assert.equal(missing.processingTimelineStatus, "DATA_UNAVAILABLE");

    const withTl = computeExchangeAmounts({
      grossPaidMinor: 10000,
      fareRules: { changeFeeMinor: 0, processingTimelineDays: 5 },
      newFareMinor: 10000,
      pricingAgencyFeeBps: 0,
    });
    assert.equal(withTl.processingTimelineStatus, "OK");
    assert.match(String(withTl.processingTimelineNote), /5/);
  });

  it("penalty resolver does not invent amounts", () => {
    const p = resolveSupplierPenaltyMinor(10000, { refundable: true });
    assert.equal(p.penaltyStatus, "DATA_UNAVAILABLE");
  });
});
