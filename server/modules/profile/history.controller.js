import { successResponse } from "../../lib/response.js";
import * as historyService from "./history.service.js";

export async function listHistory(req, res, next) {
  try {
    const data = await historyService.listTravelHistory(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
