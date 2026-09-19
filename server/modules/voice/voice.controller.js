import { successResponse } from "../../lib/response.js";
import { sanitizeVoiceFailure } from "./voice.errors.js";
import * as voice from "./voice.service.js";

function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(sanitizeVoiceFailure(e));
    }
  };
}

export const getCapability = handle(async (_req, res) => {
  return successResponse(res, "OK", voice.getCapability());
});

export const createSession = handle(async (req, res) => {
  const data = await voice.createWebSession(req.user.id, req.body);
  return successResponse(res, "Voice session started", data, 201);
});

export const getSession = handle(async (req, res) => {
  const data = await voice.getSession(req.user.id, req.params.sessionId);
  return successResponse(res, "OK", data);
});

export const bindCaller = handle(async (req, res) => {
  const data = await voice.bindCaller(req.user.id, req.body);
  return successResponse(res, "Caller number linked", data, 201);
});

export const processTurn = handle(async (req, res) => {
  const data = await voice.processTurn(req.user.id, req.params.sessionId, req.body);
  return successResponse(res, "OK", data);
});

export const prepareBooking = handle(async (req, res) => {
  const data = await voice.prepareVoiceBooking(req.user.id, req.params.sessionId, req.body);
  return successResponse(res, "Confirmation required", data);
});

export const requestOtp = handle(async (req, res) => {
  const data = await voice.requestVoiceBookingOtp(req.user.id, req.params.sessionId, req.body);
  return successResponse(res, "Confirmation code sent", data);
});

export const confirmOtp = handle(async (req, res) => {
  const data = await voice.confirmVoiceBookingOtp(req.user.id, req.params.sessionId, req.body);
  return successResponse(res, "Quote confirmed", data);
});

export const patchState = handle(async (req, res) => {
  const data = await voice.markSessionState(req.user.id, req.params.sessionId, req.body.state);
  return successResponse(res, "OK", data);
});

export const telephonyInbound = handle(async (req, res) => {
  const data = await voice.handleTelephonyInbound(req);
  return successResponse(res, "OK", data);
});
