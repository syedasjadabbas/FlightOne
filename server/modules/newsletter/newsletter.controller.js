import { successResponse } from "../../lib/response.js";
import { subscribeToNewsletter } from "./newsletter.service.js";

export async function subscribe(req, res, next) {
  try {
    const data = await subscribeToNewsletter(req.body);
    return successResponse(res, "Subscribed", data);
  } catch (e) {
    next(e);
  }
}
