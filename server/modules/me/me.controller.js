import { successResponse } from "../../lib/response.js";
import { getEffectivePermissions } from "../../lib/permissions.service.js";
import * as meService from "./me.service.js";

export async function me(req, res, next) {
  try {
    const data = await meService.getMe(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function permissions(req, res, next) {
  try {
    // requireAuth already resolved this; fall back to a fresh lookup defensively.
    const data = req.permissions ?? (await getEffectivePermissions(req.user.id));
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
