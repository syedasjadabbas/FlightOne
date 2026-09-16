/**
 * Module 14 — fail-closed refund / servicing math.
 * Never invents penalties, agency fees, or processing timelines.
 */
import {
  assertNonNegativeBps,
  assertNonNegativeMinorAmount,
  bpsOfMinor,
} from "../../lib/money.js";

/**
 * Resolve agency fee from authoritative sources only.
 * Priority: fareRules.agencyFeeMinor → fareRules.agencyFeeBps →
 * explicit PricingConfig/env (including explicit 0) → UNAVAILABLE (fee treated as 0
 * for arithmetic but flagged — never invented commercial fees).
 */
export function resolveAgencyFeeMinor(grossPaidMinor, fareRules, pricingAgencyFeeBps) {
  assertNonNegativeMinorAmount(grossPaidMinor, "grossPaidMinor");
  const rules = fareRules && typeof fareRules === "object" ? fareRules : {};

  if (rules.agencyFeeMinor != null) {
    const fee = Number(rules.agencyFeeMinor);
    assertNonNegativeMinorAmount(fee, "fareRules.agencyFeeMinor");
    return {
      agencyFeeMinor: fee,
      agencyFeeStatus: "OK",
      agencyFeeSource: "fareRules.agencyFeeMinor",
    };
  }

  if (rules.agencyFeeBps != null) {
    const bps = Number(rules.agencyFeeBps);
    assertNonNegativeBps(bps, "fareRules.agencyFeeBps");
    return {
      agencyFeeMinor: bpsOfMinor(grossPaidMinor, bps),
      agencyFeeStatus: "OK",
      agencyFeeSource: "fareRules.agencyFeeBps",
      agencyFeeBps: bps,
    };
  }

  if (pricingAgencyFeeBps != null && Number.isFinite(Number(pricingAgencyFeeBps))) {
    const bps = Number(pricingAgencyFeeBps);
    assertNonNegativeBps(bps, "pricingAgencyFeeBps");
    return {
      agencyFeeMinor: bpsOfMinor(grossPaidMinor, bps),
      agencyFeeStatus: "OK",
      agencyFeeSource: "pricing_config_or_env",
      agencyFeeBps: bps,
    };
  }

  return {
    agencyFeeMinor: 0,
    agencyFeeStatus: "DATA_UNAVAILABLE",
    agencyFeeSource: "not_configured",
  };
}

/**
 * Resolve supplier penalty from stored fare/cancellation rules only.
 */
export function resolveSupplierPenaltyMinor(grossPaidMinor, fareRules, { now = new Date() } = {}) {
  assertNonNegativeMinorAmount(grossPaidMinor, "grossPaidMinor");
  const rules = fareRules && typeof fareRules === "object" ? fareRules : {};

  if (rules.refundable === false) {
    return {
      supplierPenaltyMinor: grossPaidMinor,
      penaltyStatus: "OK",
      penaltySource: "fareRules.refundable=false",
      refundableFlag: false,
    };
  }

  if (rules.penaltyMinor != null) {
    const p = Number(rules.penaltyMinor);
    assertNonNegativeMinorAmount(p, "fareRules.penaltyMinor");
    return {
      supplierPenaltyMinor: Math.min(p, grossPaidMinor),
      penaltyStatus: "OK",
      penaltySource: "fareRules.penaltyMinor",
      refundableFlag: rules.refundable === true ? true : rules.refundable === false ? false : null,
    };
  }

  if (rules.penaltyBps != null) {
    const bps = Number(rules.penaltyBps);
    assertNonNegativeBps(bps, "fareRules.penaltyBps");
    return {
      supplierPenaltyMinor: bpsOfMinor(grossPaidMinor, bps),
      penaltyStatus: "OK",
      penaltySource: "fareRules.penaltyBps",
      penaltyBps: bps,
      refundableFlag: rules.refundable === true ? true : null,
    };
  }

  // Hotel free-cancel window when deadline is authoritative ISO string.
  const freeUntil =
    rules.freeCancelUntil ||
    rules.cancellationDeadline ||
    rules.freeCancellationUntil ||
    null;
  if (freeUntil && rules.refundable !== false) {
    const deadline = new Date(freeUntil);
    if (!Number.isNaN(deadline.getTime()) && now.getTime() < deadline.getTime()) {
      return {
        supplierPenaltyMinor: 0,
        penaltyStatus: "OK",
        penaltySource: "fareRules.freeCancelUntil(before_deadline)",
        freeCancelUntil: deadline.toISOString(),
        refundableFlag: true,
      };
    }
    if (!Number.isNaN(deadline.getTime()) && now.getTime() >= deadline.getTime()) {
      // Past free cancel without a numeric penalty → unavailable, not invented.
      return {
        supplierPenaltyMinor: 0,
        penaltyStatus: "DATA_UNAVAILABLE",
        penaltySource: "free_cancel_deadline_passed_no_penalty_amount",
        freeCancelUntil: deadline.toISOString(),
        refundableFlag: rules.refundable === true ? true : null,
      };
    }
  }

  // Explicit zero-penalty refundable fare.
  if (rules.refundable === true && rules.penaltyBps === 0) {
    return {
      supplierPenaltyMinor: 0,
      penaltyStatus: "OK",
      penaltySource: "fareRules.refundable=true+penaltyBps=0",
      refundableFlag: true,
    };
  }

  if (rules.refundable === true && (rules.changeFeeMinor === 0 || rules.cancellationFeeMinor === 0)) {
    const zero =
      rules.cancellationFeeMinor === 0
        ? Number(rules.cancellationFeeMinor)
        : Number(rules.changeFeeMinor);
    return {
      supplierPenaltyMinor: zero,
      penaltyStatus: "OK",
      penaltySource:
        rules.cancellationFeeMinor === 0
          ? "fareRules.cancellationFeeMinor=0"
          : "fareRules.changeFeeMinor=0",
      refundableFlag: true,
    };
  }

  return {
    supplierPenaltyMinor: 0,
    penaltyStatus: "DATA_UNAVAILABLE",
    penaltySource: "no_authoritative_penalty",
    refundableFlag: rules.refundable === true ? true : rules.refundable === false ? false : null,
  };
}

export function resolveProcessingTimeline(fareRules) {
  const rules = fareRules && typeof fareRules === "object" ? fareRules : {};
  if (rules.processingTimelineNote && typeof rules.processingTimelineNote === "string") {
    return {
      processingTimelineStatus: "OK",
      processingTimelineNote: rules.processingTimelineNote.slice(0, 500),
      processingTimelineSource: "fareRules.processingTimelineNote",
    };
  }
  if (rules.processingTimelineDays != null && Number.isFinite(Number(rules.processingTimelineDays))) {
    const days = Number(rules.processingTimelineDays);
    return {
      processingTimelineStatus: "OK",
      processingTimelineNote: `${days} supplier-stated day(s)`,
      processingTimelineDays: days,
      processingTimelineSource: "fareRules.processingTimelineDays",
    };
  }
  return {
    processingTimelineStatus: "DATA_UNAVAILABLE",
    processingTimelineNote: null,
    processingTimelineSource: "not_provided_by_supplier",
  };
}

/**
 * Pure refund calculation — never invents defaults for penalty/fee.
 */
export function computeRefundAmounts(grossPaidMinor, fareRules, options = {}) {
  assertNonNegativeMinorAmount(grossPaidMinor, "grossPaidMinor");
  const rules = fareRules && typeof fareRules === "object" ? fareRules : {};
  const partialRatio =
    options.partialRatio != null && Number.isFinite(Number(options.partialRatio))
      ? Math.min(1, Math.max(0, Number(options.partialRatio)))
      : 1;
  const basisGross = Math.round(grossPaidMinor * partialRatio);
  assertNonNegativeMinorAmount(basisGross, "basisGross");

  const penalty = resolveSupplierPenaltyMinor(basisGross, rules, { now: options.now });
  const agency = resolveAgencyFeeMinor(basisGross, rules, options.pricingAgencyFeeBps);
  const timeline = resolveProcessingTimeline(rules);

  if (rules.refundable === false) {
    return {
      supplierPenaltyMinor: basisGross,
      agencyFeeMinor: 0,
      refundableMinor: 0,
      nonRefundableMinor: basisGross,
      travelCreditMinor: 0,
      dataStatus: "OK",
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "NON_REFUNDABLE_FARE",
        refundable: false,
        grossPaidMinor,
        basisGross,
        partialRatio,
        productHint: options.product || null,
        ...timeline,
      },
    };
  }

  // Schedule-change (airline-initiated): zero customer penalty when attributed.
  if (options.scheduleChangeAttributed === true) {
    const fee = agency;
    const refundableMinor = Math.max(0, basisGross - fee.agencyFeeMinor);
    const dataStatus =
      fee.agencyFeeStatus === "OK" || fee.agencyFeeStatus === "DATA_UNAVAILABLE" ? "OK" : fee.agencyFeeStatus;
    return {
      supplierPenaltyMinor: 0,
      agencyFeeMinor: fee.agencyFeeMinor,
      refundableMinor,
      nonRefundableMinor: Math.max(0, basisGross - refundableMinor),
      travelCreditMinor: 0,
      dataStatus,
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "AIRLINE_SCHEDULE_CHANGE",
        scheduleChangeAttributed: true,
        grossPaidMinor,
        basisGross,
        agencyFee: fee,
        ...timeline,
      },
    };
  }

  if (penalty.penaltyStatus === "DATA_UNAVAILABLE" && rules.refundable !== true) {
    return {
      supplierPenaltyMinor: 0,
      agencyFeeMinor: 0,
      refundableMinor: 0,
      nonRefundableMinor: basisGross,
      travelCreditMinor: 0,
      dataStatus: "DATA_UNAVAILABLE",
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "PENALTY_DATA_UNAVAILABLE",
        grossPaidMinor,
        basisGross,
        partialRatio,
        penalty,
        agencyFee: agency,
        message:
          "Supplier penalty is not present on stored fare/cancellation rules — refund amount not confirmed",
        ...timeline,
      },
    };
  }

  // refundable===true but penalty unavailable: eligibility known, amount unconfirmed.
  if (penalty.penaltyStatus === "DATA_UNAVAILABLE" && rules.refundable === true) {
    return {
      supplierPenaltyMinor: 0,
      agencyFeeMinor: agency.agencyFeeMinor,
      refundableMinor: 0,
      nonRefundableMinor: 0,
      travelCreditMinor: 0,
      dataStatus: "REQUIRES_HUMAN",
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "REFUNDABLE_BUT_PENALTY_UNAVAILABLE",
        grossPaidMinor,
        basisGross,
        penalty,
        agencyFee: agency,
        message:
          "Fare is marked refundable but no authoritative penalty amount is stored — human confirmation required",
        ...timeline,
      },
    };
  }

  const supplierPenaltyMinor = penalty.supplierPenaltyMinor;
  const agencyFeeMinor = agency.agencyFeeMinor;
  const refundableMinor = Math.max(0, basisGross - supplierPenaltyMinor - agencyFeeMinor);
  const nonRefundableMinor = Math.max(0, basisGross - refundableMinor);

  let travelCreditMinor = 0;
  let travelCreditNote = null;
  if (rules.travelCreditEligible === true && rules.travelCreditMinor != null) {
    travelCreditMinor = Number(rules.travelCreditMinor);
    assertNonNegativeMinorAmount(travelCreditMinor, "fareRules.travelCreditMinor");
    travelCreditNote = "fareRules.travelCreditMinor";
  } else if (rules.travelCreditEligible === true && refundableMinor === 0 && supplierPenaltyMinor < basisGross) {
    // Credit amount must be explicit — do not invent residual as credit.
    travelCreditNote = "travelCreditEligible_but_amount_unavailable";
  }

  const dataStatus =
    agency.agencyFeeStatus === "DATA_UNAVAILABLE" && options.requireAgencyFee === true
      ? "DATA_UNAVAILABLE"
      : "OK";

  return {
    supplierPenaltyMinor,
    agencyFeeMinor,
    refundableMinor,
    nonRefundableMinor,
    travelCreditMinor,
    dataStatus,
    processingTimelineStatus: timeline.processingTimelineStatus,
    processingTimelineNote: timeline.processingTimelineNote,
    formula: {
      rule: "AUTHORITATIVE_FARE_RULES",
      refundable: rules.refundable ?? null,
      grossPaidMinor,
      basisGross,
      partialRatio,
      productHint: options.product || null,
      penalty,
      agencyFee: agency,
      travelCreditNote,
      ...timeline,
    },
  };
}

/**
 * Exchange / reissue difference — only with authoritative inputs.
 * Does not mutate tickets; amounts are for human/ops servicing quotes.
 */
export function computeExchangeAmounts({
  grossPaidMinor,
  fareRules,
  newFareMinor,
  pricingAgencyFeeBps,
} = {}) {
  assertNonNegativeMinorAmount(grossPaidMinor, "grossPaidMinor");
  const rules = fareRules && typeof fareRules === "object" ? fareRules : {};
  const timeline = resolveProcessingTimeline(rules);

  if (rules.changeAllowed === false || rules.exchangeAllowed === false) {
    return {
      dataStatus: "NOT_ELIGIBLE",
      changePenaltyMinor: 0,
      agencyFeeMinor: 0,
      fareDifferenceMinor: 0,
      customerDueMinor: 0,
      customerRefundMinor: 0,
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: { rule: "EXCHANGE_NOT_ALLOWED", changeAllowed: false, ...timeline },
    };
  }

  let changePenaltyMinor = null;
  let penaltyStatus = "DATA_UNAVAILABLE";
  if (rules.changeFeeMinor != null) {
    changePenaltyMinor = Number(rules.changeFeeMinor);
    assertNonNegativeMinorAmount(changePenaltyMinor, "fareRules.changeFeeMinor");
    penaltyStatus = "OK";
  } else if (rules.changeFeeBps != null) {
    const bps = Number(rules.changeFeeBps);
    assertNonNegativeBps(bps, "fareRules.changeFeeBps");
    changePenaltyMinor = bpsOfMinor(grossPaidMinor, bps);
    penaltyStatus = "OK";
  }

  if (penaltyStatus !== "OK") {
    return {
      dataStatus: "DATA_UNAVAILABLE",
      changePenaltyMinor: 0,
      agencyFeeMinor: 0,
      fareDifferenceMinor: 0,
      customerDueMinor: 0,
      customerRefundMinor: 0,
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "CHANGE_FEE_UNAVAILABLE",
        message: "No authoritative change fee on stored fare rules",
        ...timeline,
      },
    };
  }

  if (newFareMinor == null || !Number.isFinite(Number(newFareMinor))) {
    return {
      dataStatus: "DATA_UNAVAILABLE",
      changePenaltyMinor,
      agencyFeeMinor: 0,
      fareDifferenceMinor: 0,
      customerDueMinor: 0,
      customerRefundMinor: 0,
      processingTimelineStatus: timeline.processingTimelineStatus,
      processingTimelineNote: timeline.processingTimelineNote,
      formula: {
        rule: "NEW_FARE_UNAVAILABLE",
        changePenaltyMinor,
        message: "New fare amount is required from an authoritative quote — not provided",
        ...timeline,
      },
    };
  }

  const newFare = Number(newFareMinor);
  assertNonNegativeMinorAmount(newFare, "newFareMinor");
  const fareDifferenceMinor = newFare - grossPaidMinor;
  const agency = resolveAgencyFeeMinor(grossPaidMinor, rules, pricingAgencyFeeBps);

  let customerDueMinor = 0;
  let customerRefundMinor = 0;
  if (fareDifferenceMinor >= 0) {
    customerDueMinor = fareDifferenceMinor + changePenaltyMinor + agency.agencyFeeMinor;
  } else {
    const residual = Math.abs(fareDifferenceMinor) - changePenaltyMinor - agency.agencyFeeMinor;
    if (residual > 0) customerRefundMinor = residual;
    else customerDueMinor = Math.abs(residual);
  }

  return {
    dataStatus: "OK",
    changePenaltyMinor,
    agencyFeeMinor: agency.agencyFeeMinor,
    fareDifferenceMinor,
    customerDueMinor,
    customerRefundMinor,
    processingTimelineStatus: timeline.processingTimelineStatus,
    processingTimelineNote: timeline.processingTimelineNote,
    formula: {
      rule: "EXCHANGE_AUTHORITATIVE",
      grossPaidMinor,
      newFareMinor: newFare,
      changePenaltyMinor,
      agencyFee: agency,
      fareDifferenceMinor,
      customerDueMinor,
      customerRefundMinor,
      humanServicingOnly: true,
      liveGdsMutation: false,
      ...timeline,
    },
  };
}
