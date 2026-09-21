import { successResponse } from "../../lib/response.js";
import * as compsService from "./comps.service.js";

/** GET /api/v1/comps/status */
export async function status(_req, res, next) {
  try {
    return successResponse(res, "OK", {
      configured: compsService.isSerpConfigured(),
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/comps/flights — soft-fail empty options when Serp unavailable. */
export async function flights(req, res, next) {
  try {
    const result = await compsService.searchFlights(req.body);
    return successResponse(res, "OK", {
      options: result.options,
      lowestPriceMajor: result.lowestPriceMajor,
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/comps/hotels — soft-fail empty properties when Serp unavailable. */
export async function hotels(req, res, next) {
  try {
    const result = await compsService.searchHotels(req.body);
    return successResponse(res, "OK", {
      properties: result.properties,
    });
  } catch (e) {
    next(e);
  }
}
