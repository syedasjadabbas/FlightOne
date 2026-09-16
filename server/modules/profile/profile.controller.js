import { successResponse } from "../../lib/response.js";
import * as profileService from "./profile.service.js";

export async function getProfile(req, res, next) {
  try {
    const data = await profileService.getOrCreateProfile(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function patchProfile(req, res, next) {
  try {
    const data = await profileService.updateProfile(req.user.id, req.body);
    return successResponse(res, "Profile updated", data);
  } catch (e) {
    next(e);
  }
}
