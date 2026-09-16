import { successResponse } from "../../lib/response.js";
import * as suppliersService from "./suppliers.service.js";

function headerUserId(req) {
  const raw = req.headers["x-flightone-user-id"];
  if (typeof raw !== "string") return null;
  const scoped = raw.trim();
  if (!scoped || scoped === "internal") return null;
  return scoped;
}

/**
 * Snapshot owner is never taken from JSON body (clients must not choose userId).
 * JWT search uses the authenticated subject. The Next.js server proxy may pass
 * a verified user id only with the internal API key.
 */
function resolveSearchUserId(req) {
  const authUserId = req.user?.id;
  if (authUserId && authUserId !== "internal") {
    return authUserId;
  }
  if (req.authMode === "internal") {
    return headerUserId(req);
  }
  return null;
}

export async function search(req, res, next) {
  try {
    const userId = resolveSearchUserId(req);
    const offers = await suppliersService.search({
      product: req.body.product,
      query: req.body.query,
      userId,
    });
    return successResponse(res, "OK", { offers });
  } catch (e) {
    next(e);
  }
}
