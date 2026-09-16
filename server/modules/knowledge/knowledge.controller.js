import { successResponse } from "../../lib/response.js";
import * as knowledgeService from "./knowledge.service.js";

function perms(req) {
  return req.permissions ?? { global: [], byCompany: {} };
}

export async function createDocument(req, res, next) {
  try {
    const data = await knowledgeService.createKnowledgeDocument(req.body, {
      userId: req.user.id,
      permissions: perms(req),
    });
    return successResponse(res, "Knowledge document created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function createVersion(req, res, next) {
  try {
    const data = await knowledgeService.createNewVersion(req.params.id, req.body, {
      userId: req.user.id,
      permissions: perms(req),
    });
    return successResponse(res, "Knowledge version created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function publishDocument(req, res, next) {
  try {
    const data = await knowledgeService.publishDocument(req.params.id, {
      userId: req.user.id,
      permissions: perms(req),
    });
    return successResponse(res, "Knowledge document published", data);
  } catch (e) {
    next(e);
  }
}

export async function archiveDocument(req, res, next) {
  try {
    const data = await knowledgeService.archiveDocument(req.params.id, {
      userId: req.user.id,
      permissions: perms(req),
    });
    return successResponse(res, "Knowledge document archived", data);
  } catch (e) {
    next(e);
  }
}

export async function updateMetadata(req, res, next) {
  try {
    const data = await knowledgeService.updateMetadata(req.params.id, req.body, {
      userId: req.user.id,
      permissions: perms(req),
    });
    return successResponse(res, "Knowledge metadata updated", data);
  } catch (e) {
    next(e);
  }
}

export async function getDocument(req, res, next) {
  try {
    const data = await knowledgeService.getKnowledgeDocument(req.params.id, {
      permissions: perms(req),
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const data = await knowledgeService.listKnowledgeDocuments(req.query, {
      permissions: perms(req),
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function retrieve(req, res, next) {
  try {
    const data = await knowledgeService.retrieveKnowledge({
      ...req.body,
      permissions: perms(req),
      mode: req.body.mode || "ava",
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function avaGuidance(req, res, next) {
  try {
    const q = req.query.q || req.query.query || "";
    const data = await knowledgeService.buildAvaKnowledgeGuidance(perms(req), q);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
