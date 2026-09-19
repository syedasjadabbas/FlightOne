import { successResponse } from "../../lib/response.js";
import * as refundsService from "./refunds.service.js";

export async function eligibility(req, res, next) {
  try {
    const data = await refundsService.getRefundEligibility(
      req.user,
      req.permissions,
      req.params.bookingId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listRefundableBookings(req, res, next) {
  try {
    const data = await refundsService.listMyRefundableBookings(req.user);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function calculate(req, res, next) {
  try {
    const data = await refundsService.calculateRefund(req.user, req.permissions, req.body);
    return successResponse(res, "Refund calculation created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function createCase(req, res, next) {
  try {
    const data = await refundsService.createRefundCase(req.user, req.permissions, req.body);
    return successResponse(res, "Refund case created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function submitCase(req, res, next) {
  try {
    const data = await refundsService.submitRefundCase(req.user, req.permissions, req.params.id);
    return successResponse(res, "Refund case submitted", data);
  } catch (e) {
    next(e);
  }
}

export async function processCase(req, res, next) {
  try {
    const data = await refundsService.processRefundCase(req.user, req, req.params.id);
    return successResponse(res, "Refund case processed", data);
  } catch (e) {
    next(e);
  }
}

export async function completeCase(req, res, next) {
  try {
    const data = await refundsService.completeRefundCase(req.user, req, req.params.id);
    return successResponse(res, "Refund case completed", data);
  } catch (e) {
    next(e);
  }
}

export async function rejectCase(req, res, next) {
  try {
    const data = await refundsService.rejectRefundCase(
      req.user,
      req.permissions,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Refund case rejected", data);
  } catch (e) {
    next(e);
  }
}

export async function escalateCase(req, res, next) {
  try {
    const data = await refundsService.escalateRefundCase(
      req.user,
      req.permissions,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Escalation recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function listCases(req, res, next) {
  try {
    const data = await refundsService.listRefundCases(req.user, req.permissions, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getCaseById(req, res, next) {
  try {
    const data = await refundsService.getRefundCaseById(req.user, req.permissions, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function cancellationEligibility(req, res, next) {
  try {
    const data = await refundsService.getCancellationEligibility(
      req.user,
      req.permissions,
      req.params.bookingId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function requestCancellation(req, res, next) {
  try {
    const data = await refundsService.requestCancellation(req.user, req.permissions, req.body);
    return successResponse(res, "Cancellation request created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function calculateExchange(req, res, next) {
  try {
    const data = await refundsService.calculateExchange(req.user, req.permissions, req.body);
    return successResponse(res, "Exchange/reissue calculated", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function requestExchange(req, res, next) {
  try {
    const data = await refundsService.requestExchange(req.user, req.permissions, req.body);
    return successResponse(res, "Exchange/reissue requested", data);
  } catch (e) {
    next(e);
  }
}

export async function scheduleChange(req, res, next) {
  try {
    const data = await refundsService.createScheduleChangeServicing(
      req.user,
      req.permissions,
      req.body,
    );
    return successResponse(res, "Schedule-change servicing created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listCredits(req, res, next) {
  try {
    const data = await refundsService.listTravelCredits(req.user, req.permissions, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listServicing(req, res, next) {
  try {
    const data = await refundsService.listServicingRequests(req.user, req.permissions, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getServicing(req, res, next) {
  try {
    const data = await refundsService.getServicingRequestById(
      req.user,
      req.permissions,
      req.params.id,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function avaGuidance(req, res, next) {
  try {
    const bookingId = req.query.bookingId;
    const data = await refundsService.buildAvaRefundGuidance(req.user.id, bookingId);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
