import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as vaultController from "./vault.controller.js";
import {
  createVaultDocumentSchema,
  listVaultDocumentsQuerySchema,
  publicShareTokenParamsSchema,
  replaceVaultBinarySchema,
  shareVaultDocumentSchema,
  updateVaultDocumentSchema,
  uploadVaultDocumentSchema,
  vaultDocIdParamsSchema,
} from "./vault.validators.js";

const router = Router();

// Public share (token is the credential) — before requireAuth.
router.get(
  "/public/:token",
  validateParams(publicShareTokenParamsSchema),
  vaultController.getPublicShare,
);

router.use(requireAuth);

router.get("/capability", vaultController.capability);
router.get("/", validateQuery(listVaultDocumentsQuerySchema), vaultController.list);
router.post("/", validateBody(createVaultDocumentSchema), vaultController.create);
router.post("/upload", validateBody(uploadVaultDocumentSchema), vaultController.upload);
router.get("/:id", validateParams(vaultDocIdParamsSchema), vaultController.getById);
router.get(
  "/:id/download",
  validateParams(vaultDocIdParamsSchema),
  vaultController.download,
);
router.patch(
  "/:id",
  validateParams(vaultDocIdParamsSchema),
  validateBody(updateVaultDocumentSchema),
  vaultController.update,
);
router.post(
  "/:id/replace",
  validateParams(vaultDocIdParamsSchema),
  validateBody(replaceVaultBinarySchema),
  vaultController.replaceBinary,
);
router.delete("/:id", validateParams(vaultDocIdParamsSchema), vaultController.remove);
router.post(
  "/:id/share",
  validateParams(vaultDocIdParamsSchema),
  validateBody(shareVaultDocumentSchema),
  vaultController.share,
);

export default router;
