import { successResponse } from "../../lib/response.js";
import * as profileDedupeService from "./profileDedupe.service.js";
import * as personalizationService from "./personalization.service.js";

export async function getDuplicates(req, res, next) {
  try {
    const data = await profileDedupeService.findProfileDuplicates(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function applyDedupe(req, res, next) {
  try {
    const data = await profileDedupeService.applyProfileDedupe(req.user.id, {
      req,
    });
    return successResponse(res, "Dedupe applied", data);
  } catch (e) {
    next(e);
  }
}

export async function getPersonalization(req, res, next) {
  try {
    const data = await personalizationService.getPersonalizationBundle(
      req.user.id,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
