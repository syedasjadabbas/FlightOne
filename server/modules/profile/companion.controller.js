import { successResponse } from "../../lib/response.js";
import * as companionService from "./companion.service.js";

export async function listCompanions(req, res, next) {
  try {
    const data = await companionService.listCompanions(req.user.id, {
      kind: req.query.kind,
      includePassport: req.query.includePassport,
      req,
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createCompanion(req, res, next) {
  try {
    const data = await companionService.createCompanion(req.user.id, req.body, {
      req,
    });
    return successResponse(res, "Companion added", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function updateCompanion(req, res, next) {
  try {
    const data = await companionService.updateCompanion(
      req.user.id,
      req.params.id,
      req.body,
      { req },
    );
    return successResponse(res, "Companion updated", data);
  } catch (e) {
    next(e);
  }
}

export async function deleteCompanion(req, res, next) {
  try {
    await companionService.deleteCompanion(req.user.id, req.params.id);
    return successResponse(res, "Companion removed", {});
  } catch (e) {
    next(e);
  }
}
