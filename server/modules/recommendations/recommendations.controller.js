import { successResponse } from "../../lib/response.js";
import * as recommendationsService from "./recommendations.service.js";

export async function rank(req, res, next) {
  try {
    // Loads this authenticated user's feedback only (user isolation).
    const data = await recommendationsService.rankOffersForUser(req.user.id, req.body);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function feedback(req, res, next) {
  try {
    const data = await recommendationsService.recordFeedback(req.user.id, req.body);
    return successResponse(res, "Feedback recorded", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function learned(req, res, next) {
  try {
    const data = await recommendationsService.getLearnedPreferences(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
