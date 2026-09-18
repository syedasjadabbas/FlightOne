import { successResponse } from "../../lib/response.js";
import * as visaService from "./visa.service.js";

export async function capability(req, res, next) {
  try {
    return successResponse(res, "OK", visaService.getCapability());
  } catch (e) {
    next(e);
  }
}

export async function getRequirements(req, res, next) {
  try {
    const data = await visaService.getVisaRequirements(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function lookup(req, res, next) {
  try {
    const data = await visaService.performVisaLookup(req.body);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function assess(req, res, next) {
  try {
    const data = await visaService.assessVisaForTraveller(req.user?.id, req.body);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function escalate(req, res, next) {
  try {
    let assessment = null;
    if (req.body.destination) {
      assessment = await visaService.assessVisaForTraveller(req.user.id, req.body);
    }
    const data = await visaService.escalateVisaUncertainty({
      userId: req.user.id,
      conversationId: req.body.conversationId,
      bookingId: req.body.bookingId,
      assessment,
      reason: req.body.reason,
      req,
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createApplication(req, res, next) {
  try {
    const data = await visaService.createVisaApplication(req.user, req.body);
    return successResponse(res, "Visa application created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listApplications(req, res, next) {
  try {
    const data = await visaService.listVisaApplications(
      req.user,
      req.permissions,
      req.query,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function updateApplication(req, res, next) {
  try {
    const data = await visaService.updateVisaApplication(
      req.user,
      req.permissions,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Visa application updated", data);
  } catch (e) {
    next(e);
  }
}
