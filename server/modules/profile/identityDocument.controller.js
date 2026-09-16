import { successResponse } from "../../lib/response.js";
import * as identityDocumentService from "./identityDocument.service.js";

export async function listDocuments(req, res, next) {
  try {
    const data = await identityDocumentService.listIdentityDocuments(
      req.user.id,
      req.query,
      { req },
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getDocument(req, res, next) {
  try {
    const data = await identityDocumentService.getIdentityDocument(
      req.user.id,
      req.params.id,
      { req },
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createDocument(req, res, next) {
  try {
    const data = await identityDocumentService.createIdentityDocument(
      req.user.id,
      req.body,
      { req },
    );
    return successResponse(res, "Identity document added", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function updateDocument(req, res, next) {
  try {
    const data = await identityDocumentService.updateIdentityDocument(
      req.user.id,
      req.params.id,
      req.body,
      { req },
    );
    return successResponse(res, "Identity document updated", data);
  } catch (e) {
    next(e);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    await identityDocumentService.deleteIdentityDocument(
      req.user.id,
      req.params.id,
      { req },
    );
    return successResponse(res, "Identity document removed", {});
  } catch (e) {
    next(e);
  }
}

export async function reuploadDocument(req, res, next) {
  try {
    const data = await identityDocumentService.reuploadIdentityDocument(
      req.user.id,
      req.params.id,
      req.body,
      { req },
    );
    return successResponse(res, "Identity document re-uploaded", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function verifyDocument(req, res, next) {
  try {
    const data = await identityDocumentService.setIdentityDocumentVerification(
      req.user.id,
      req.params.id,
      req.body,
      { req, actorUserId: req.user.id },
    );
    return successResponse(res, "Verification updated", data);
  } catch (e) {
    next(e);
  }
}

export async function runOcr(req, res, next) {
  try {
    const data = await identityDocumentService.runIdentityDocumentOcr(
      req.user.id,
      req.params.id,
      req.body,
      { req },
    );
    return successResponse(res, "OCR extraction ready for review", data);
  } catch (e) {
    next(e);
  }
}

export async function applyOcr(req, res, next) {
  try {
    const data = await identityDocumentService.applyIdentityDocumentOcr(
      req.user.id,
      req.params.id,
      req.body,
      { req },
    );
    return successResponse(res, "Accepted OCR fields applied", data);
  } catch (e) {
    next(e);
  }
}
