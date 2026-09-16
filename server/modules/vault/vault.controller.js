import { successResponse } from "../../lib/response.js";
import * as vaultService from "./vault.service.js";

export async function capability(req, res, next) {
  try {
    const data = vaultService.getStorageCapability();
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const data = await vaultService.listMyDocuments(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const data = await vaultService.createDocument(req.user.id, req, req.body);
    return successResponse(res, "Document created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function upload(req, res, next) {
  try {
    const data = await vaultService.uploadDocument(req.user.id, req, req.body);
    return successResponse(res, "Document uploaded", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const data = await vaultService.getDocumentById(req.user.id, req, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function download(req, res, next) {
  try {
    const file = await vaultService.downloadDocument(req.user.id, req, req.params.id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalFilename)}"`,
    );
    res.setHeader("Content-Length", String(file.byteSize));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(file.buffer);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const data = await vaultService.updateDocument(req.user.id, req, req.params.id, req.body);
    return successResponse(res, "Document updated", data);
  } catch (e) {
    next(e);
  }
}

export async function replaceBinary(req, res, next) {
  try {
    const data = await vaultService.replaceDocumentBinary(
      req.user.id,
      req,
      req.params.id,
      req.body,
    );
    return successResponse(res, "Document replaced", data);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await vaultService.deleteDocument(req.user.id, req, req.params.id);
    return successResponse(res, "Document deleted", data);
  } catch (e) {
    next(e);
  }
}

export async function share(req, res, next) {
  try {
    const data = await vaultService.createShareLink(req.user.id, req, req.params.id, req.body);
    return successResponse(res, "Share link created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function getPublicShare(req, res, next) {
  try {
    const data = await vaultService.getPublicDocument(req, req.params.token);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
