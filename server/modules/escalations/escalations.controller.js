import { successResponse } from "../../lib/response.js";
import * as escalationsService from "./escalations.service.js";

export async function listMine(req, res, next) {
  try {
    const data = await escalationsService.listMyEscalations(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getMine(req, res, next) {
  try {
    const data = await escalationsService.getMyEscalationById(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function request(req, res, next) {
  try {
    const data = await escalationsService.requestEscalationForCustomer(req.user.id, req.body);
    return successResponse(res, "Escalation requested", data);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const data = await escalationsService.listEscalations(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const data = await escalationsService.getEscalationById(req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function claim(req, res, next) {
  try {
    const data = await escalationsService.claimEscalation(req.params.id, req.user.id);
    return successResponse(res, "Escalation claimed", data);
  } catch (e) {
    next(e);
  }
}

export async function assign(req, res, next) {
  try {
    const data = await escalationsService.assignEscalation(req.params.id, req.user.id, req.body);
    return successResponse(res, "Escalation assigned", data);
  } catch (e) {
    next(e);
  }
}

export async function start(req, res, next) {
  try {
    const data = await escalationsService.startEscalation(req.params.id, req.user.id);
    return successResponse(res, "Escalation in progress", data);
  } catch (e) {
    next(e);
  }
}

export async function resolve(req, res, next) {
  try {
    const data = await escalationsService.resolveEscalation(
      req.params.id,
      req.user.id,
      req.body,
    );
    return successResponse(res, "Escalation resolved", data);
  } catch (e) {
    next(e);
  }
}

export async function cancel(req, res, next) {
  try {
    const data = await escalationsService.cancelEscalation(req.params.id, req.user.id, req.body);
    return successResponse(res, "Escalation cancelled", data);
  } catch (e) {
    next(e);
  }
}

export async function applyAction(req, res, next) {
  try {
    const data = await escalationsService.applyEscalationConsultantAction(
      req.params.id,
      req.user,
      req.permissions,
      req.body,
    );
    return successResponse(res, "Consultant action recorded", data);
  } catch (e) {
    next(e);
  }
}
