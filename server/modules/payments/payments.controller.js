import { successResponse } from "../../lib/response.js";
import * as paymentsService from "./payments.service.js";

export async function capability(req, res, next) {
  try {
    const method = req.query.method;
    return successResponse(res, "OK", paymentsService.getPaymentCapability(method));
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

export async function jazzcashCallback(req, res, next) {
  try {
    const payload = { ...req.query, ...req.body };
    const data = await paymentsService.handleJazzCashCallback(payload);
    return successResponse(res, "JazzCash callback processed", data);
  } catch (e) {
    next(e);
  }
}

export async function easypaisaCallback(req, res, next) {
  try {
    const payload = { ...req.query, ...req.body };
    const data = await paymentsService.handleEasypaisaCallback(payload);
    return successResponse(res, "Easypaisa callback processed", data);
  } catch (e) {
    next(e);
  }
}

export async function onelinkCallback(req, res, next) {
  try {
    const data = await paymentsService.handleOneLinkCallback(req.body);
    return successResponse(res, "1Link callback processed", data);
  } catch (e) {
    next(e);
  }
}

export async function confirmBankTransfer(req, res, next) {
  try {
    const data = await paymentsService.confirmBankTransferPayment(req.params.id, {
      staffUserId: req.user?.id,
      bankReference: req.body?.bankReference,
    });
    return successResponse(res, "Bank transfer confirmed", data);
  } catch (e) {
    next(e);
  }
}
