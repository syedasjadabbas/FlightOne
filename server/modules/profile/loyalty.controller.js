import { successResponse } from "../../lib/response.js";
import * as loyaltyService from "./loyalty.service.js";

export async function listLoyalty(req, res, next) {
  try {
    const data = await loyaltyService.listLoyaltyMemberships(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createLoyalty(req, res, next) {
  try {
    const data = await loyaltyService.addLoyaltyMembership(req.user.id, req.body);
    return successResponse(res, "Loyalty membership added", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function updateLoyalty(req, res, next) {
  try {
    const data = await loyaltyService.updateLoyaltyMembership(
      req.user.id,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Loyalty membership updated", data);
  } catch (e) {
    next(e);
  }
}

export async function deleteLoyalty(req, res, next) {
  try {
    await loyaltyService.deleteLoyaltyMembership(req.user.id, req.params.id);
    return successResponse(res, "Loyalty membership removed", {});
  } catch (e) {
    next(e);
  }
}
