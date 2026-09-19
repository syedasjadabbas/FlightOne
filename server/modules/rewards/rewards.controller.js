import { successResponse } from "../../lib/response.js";
import * as rewardsService from "./rewards.service.js";

export async function getSummary(req, res, next) {
  try {
    const data = await rewardsService.getBalance(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listLedger(req, res, next) {
  try {
    const data = await rewardsService.listLedger(req.user, req.permissions, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listReferrals(req, res, next) {
  try {
    const data = await rewardsService.listMyReferrals(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function redeem(req, res, next) {
  try {
    const data = await rewardsService.redeemPoints(req.user.id, req.body.points, {
      idempotencyKey: req.body.idempotencyKey,
    });
    return successResponse(res, "Points redeemed", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function checkoutCredit(req, res, next) {
  try {
    const data = await rewardsService.applyRewardCreditToBooking(
      req.user.id,
      req.body.bookingId,
      req.body.points,
      { idempotencyKey: req.body.idempotencyKey },
    );
    return successResponse(res, "Reward credit applied", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function attachReferral(req, res, next) {
  try {
    const data = await rewardsService.attachReferral(req.user.id, req.body.code);
    return successResponse(res, "Referral attached", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function getCorporateProgram(req, res, next) {
  try {
    const data = await rewardsService.getCorporateProgram(
      req.user.id,
      req.params.companyId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function upsertCorporateProgram(req, res, next) {
  try {
    const data = await rewardsService.upsertCorporateProgram(
      req.user.id,
      req.params.companyId,
      req.body,
    );
    return successResponse(res, "Corporate reward programme saved", data);
  } catch (e) {
    next(e);
  }
}

export async function getLedgerEntry(req, res, next) {
  try {
    const data = await rewardsService.getLedgerEntry(
      req.user,
      req.permissions,
      req.params.entryId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getPolicy(req, res, next) {
  try {
    return successResponse(res, "OK", rewardsService.getPublicRewardsPolicy());
  } catch (e) {
    next(e);
  }
}
