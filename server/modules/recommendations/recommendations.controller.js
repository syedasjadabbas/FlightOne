import { successResponse } from "../../lib/response.js";
import * as recommendationsService from "./recommendations.service.js";
import * as predictive from "./recommendations.predictive.js";
import { getCalendarCapability } from "./recommendations.calendar.js";

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

export async function calendarCapability(req, res, next) {
  try {
    return successResponse(res, "OK", getCalendarCapability());
  } catch (e) {
    next(e);
  }
}

export async function listPredictive(req, res, next) {
  try {
    const data = await predictive.listPredictiveRecommendations(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function dismissPredictive(req, res, next) {
  try {
    const data = await predictive.dismissPredictiveRecommendation(req.user.id, req.body.id);
    return successResponse(res, "Dismissed", data);
  } catch (e) {
    next(e);
  }
}

export async function getPredictivePrefs(req, res, next) {
  try {
    const data = await predictive.getPredictivePreferences(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function patchPredictivePrefs(req, res, next) {
  try {
    const data = await predictive.updatePredictivePreferences(req.user.id, req.body);
    return successResponse(res, "Preferences updated", data);
  } catch (e) {
    next(e);
  }
}

export async function fareInsight(req, res, next) {
  try {
    const data = await predictive.getFareInsight(req.user?.id || null, req.body);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
