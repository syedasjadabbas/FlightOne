import { successResponse } from "../../lib/response.js";
import * as emergencyContactService from "./emergencyContact.service.js";

export async function listContacts(req, res, next) {
  try {
    const data = await emergencyContactService.listEmergencyContacts(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createContact(req, res, next) {
  try {
    const data = await emergencyContactService.createEmergencyContact(
      req.user.id,
      req.body,
    );
    return successResponse(res, "Emergency contact added", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function updateContact(req, res, next) {
  try {
    const data = await emergencyContactService.updateEmergencyContact(
      req.user.id,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Emergency contact updated", data);
  } catch (e) {
    next(e);
  }
}

export async function deleteContact(req, res, next) {
  try {
    await emergencyContactService.deleteEmergencyContact(
      req.user.id,
      req.params.id,
    );
    return successResponse(res, "Emergency contact removed", {});
  } catch (e) {
    next(e);
  }
}
