import { successResponse } from "../../lib/response.js";
import * as paymentsService from "./payments.service.js";

export async function capability(_req, res, next) {
  try {
    return successResponse(res, "OK", paymentsService.getPaymentCapability());
  } catch (e) {
    next(e);
  }
}

export async function pay(req, res, next) {
  try {
    const data = await paymentsService.payBooking(req.user.id, req.params.id, req.body);
    return successResponse(res, "Payment recorded", data);
  } catch (e) {
    next(e);
  }
}
