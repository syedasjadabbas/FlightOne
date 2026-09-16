import { successResponse } from "../../lib/response.js";
import * as mice from "./mice.service.js";

function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

export const createEvent = handle(async (req, res) => {
  const data = await mice.createEvent(req.user.id, req.body);
  return successResponse(res, "Event created", data, 201);
});

export const listEvents = handle(async (req, res) => {
  const data = await mice.listEvents(req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const getEvent = handle(async (req, res) => {
  const data = await mice.getEvent(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const updateEvent = handle(async (req, res) => {
  const data = await mice.updateEvent(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Event updated", data);
});

export const registerDelegate = handle(async (req, res) => {
  const data = await mice.registerDelegate(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Delegate registered", data, 201);
});

export const selfRegister = handle(async (req, res) => {
  const data = await mice.selfRegister(req.params.id, req.user.id, req.body);
  return successResponse(res, "Registered", data, 201);
});

export const listDelegates = handle(async (req, res) => {
  const data = await mice.listDelegates(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const createSession = handle(async (req, res) => {
  const data = await mice.createSession(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Session created", data, 201);
});

export const listSessions = handle(async (req, res) => {
  const data = await mice.listSessions(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const checkIn = handle(async (req, res) => {
  const data = await mice.checkIn(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Checked in", data, 201);
});

export const getAttendance = handle(async (req, res) => {
  const data = await mice.getAttendance(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const getBadge = handle(async (req, res) => {
  const data = await mice.getDelegateBadge(
    req.params.id,
    req.params.delegateId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const linkBooking = handle(async (req, res) => {
  const data = await mice.linkBooking(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Booking linked", data, 201);
});

export const listTravel = handle(async (req, res) => {
  const data = await mice.listLinkedTravel(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const createTransfer = handle(async (req, res) => {
  const data = await mice.createTransfer(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Transfer requirement recorded", data, 201);
});

export const updateTransfer = handle(async (req, res) => {
  const data = await mice.updateTransfer(
    req.params.id,
    req.params.transferId,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Transfer updated", data);
});

export const bookTransfer = handle(async (req, res) => {
  const data = await mice.bookTransfer(
    req.params.id,
    req.params.transferId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "Transfer booking evaluated", data);
});

export const listTransfers = handle(async (req, res) => {
  const data = await mice.listTransfers(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const getTransferCapability = handle(async (_req, res) => {
  const data = mice.getTransferCapability();
  return successResponse(res, "OK", data);
});

export const upsertBudgetLine = handle(async (req, res) => {
  const data = await mice.upsertBudgetLine(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Budget line saved", data, 201);
});

export const getBudget = handle(async (req, res) => {
  const data = await mice.getBudget(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const createSponsor = handle(async (req, res) => {
  const data = await mice.createSponsor(req.params.id, req.user.id, req.permissions, req.body);
  return successResponse(res, "Sponsor added", data, 201);
});

export const listSponsors = handle(async (req, res) => {
  const data = await mice.listSponsors(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const getReport = handle(async (req, res) => {
  const data = await mice.getEventReport(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});
