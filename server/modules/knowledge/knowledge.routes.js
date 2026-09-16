import { Router } from "express";
import { validateBody, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requireAnyPermission } from "../../middlewares/permission.js";
import * as knowledgeController from "./knowledge.controller.js";
import {
  avaGuidanceQuerySchema,
  createKnowledgeDocumentSchema,
  createVersionSchema,
  listKnowledgeDocumentsQuerySchema,
  retrieveKnowledgeSchema,
  updateMetadataSchema,
} from "./knowledge.validators.js";

const managePerms = ["ops:dashboard:read", "knowledge:write"];
const readAdminPerms = ["ops:dashboard:read", "knowledge:write", "knowledge:read"];

const router = Router();

router.use(requireAuth);

router.get(
  "/ava-guidance",
  validateQuery(avaGuidanceQuerySchema),
  knowledgeController.avaGuidance,
);

router.post(
  "/retrieve",
  validateBody(retrieveKnowledgeSchema),
  knowledgeController.retrieve,
);

router.post(
  "/documents",
  requireAnyPermission(managePerms),
  validateBody(createKnowledgeDocumentSchema),
  knowledgeController.createDocument,
);

router.get(
  "/documents",
  requireAnyPermission(readAdminPerms),
  validateQuery(listKnowledgeDocumentsQuerySchema),
  knowledgeController.listDocuments,
);

router.get(
  "/documents/:id",
  requireAnyPermission(readAdminPerms),
  knowledgeController.getDocument,
);

router.patch(
  "/documents/:id",
  requireAnyPermission(managePerms),
  validateBody(updateMetadataSchema),
  knowledgeController.updateMetadata,
);

router.post(
  "/documents/:id/versions",
  requireAnyPermission(managePerms),
  validateBody(createVersionSchema),
  knowledgeController.createVersion,
);

router.post(
  "/documents/:id/publish",
  requireAnyPermission(managePerms),
  knowledgeController.publishDocument,
);

router.post(
  "/documents/:id/archive",
  requireAnyPermission(managePerms),
  knowledgeController.archiveDocument,
);

export default router;
