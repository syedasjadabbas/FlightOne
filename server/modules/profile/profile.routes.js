import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as profileController from "./profile.controller.js";
import * as companionController from "./companion.controller.js";
import * as loyaltyController from "./loyalty.controller.js";
import * as identityDocumentController from "./identityDocument.controller.js";
import * as emergencyContactController from "./emergencyContact.controller.js";
import * as historyController from "./history.controller.js";
import * as profileExtrasController from "./profileExtras.controller.js";
import {
  updateProfileSchema,
  createCompanionSchema,
  updateCompanionSchema,
  companionIdParamsSchema,
  listCompanionsQuerySchema,
  createLoyaltySchema,
  updateLoyaltySchema,
  loyaltyIdParamsSchema,
  createIdentityDocumentSchema,
  updateIdentityDocumentSchema,
  identityDocumentIdParamsSchema,
  listIdentityDocumentsQuerySchema,
  reuploadIdentityDocumentSchema,
  verifyIdentityDocumentSchema,
  runOcrSchema,
  applyOcrSchema,
  createEmergencyContactSchema,
  updateEmergencyContactSchema,
  emergencyContactIdParamsSchema,
  travelHistoryQuerySchema,
} from "./profile.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/", profileController.getProfile);
router.patch("/", validateBody(updateProfileSchema), profileController.patchProfile);

router.get("/personalization", profileExtrasController.getPersonalization);
router.get("/duplicates", profileExtrasController.getDuplicates);
router.post("/dedupe", profileExtrasController.applyDedupe);

router.get(
  "/companions",
  validateQuery(listCompanionsQuerySchema),
  companionController.listCompanions,
);
router.post(
  "/companions",
  validateBody(createCompanionSchema),
  companionController.createCompanion,
);
router.patch(
  "/companions/:id",
  validateParams(companionIdParamsSchema),
  validateBody(updateCompanionSchema),
  companionController.updateCompanion,
);
router.delete(
  "/companions/:id",
  validateParams(companionIdParamsSchema),
  companionController.deleteCompanion,
);

router.get("/loyalty", loyaltyController.listLoyalty);
router.post(
  "/loyalty",
  validateBody(createLoyaltySchema),
  loyaltyController.createLoyalty,
);
router.patch(
  "/loyalty/:id",
  validateParams(loyaltyIdParamsSchema),
  validateBody(updateLoyaltySchema),
  loyaltyController.updateLoyalty,
);
router.delete(
  "/loyalty/:id",
  validateParams(loyaltyIdParamsSchema),
  loyaltyController.deleteLoyalty,
);

router.get(
  "/documents",
  validateQuery(listIdentityDocumentsQuerySchema),
  identityDocumentController.listDocuments,
);
router.post(
  "/documents",
  validateBody(createIdentityDocumentSchema),
  identityDocumentController.createDocument,
);
router.get(
  "/documents/:id",
  validateParams(identityDocumentIdParamsSchema),
  identityDocumentController.getDocument,
);
router.patch(
  "/documents/:id",
  validateParams(identityDocumentIdParamsSchema),
  validateBody(updateIdentityDocumentSchema),
  identityDocumentController.updateDocument,
);
router.delete(
  "/documents/:id",
  validateParams(identityDocumentIdParamsSchema),
  identityDocumentController.deleteDocument,
);
router.post(
  "/documents/:id/reupload",
  validateParams(identityDocumentIdParamsSchema),
  validateBody(reuploadIdentityDocumentSchema),
  identityDocumentController.reuploadDocument,
);
router.post(
  "/documents/:id/verify",
  validateParams(identityDocumentIdParamsSchema),
  validateBody(verifyIdentityDocumentSchema),
  identityDocumentController.verifyDocument,
);
router.post(
  "/documents/:id/ocr",
  validateParams(identityDocumentIdParamsSchema),
  validateBody(runOcrSchema),
  identityDocumentController.runOcr,
);
router.post(
  "/documents/:id/ocr/apply",
  validateParams(identityDocumentIdParamsSchema),
  validateBody(applyOcrSchema),
  identityDocumentController.applyOcr,
);

router.get("/emergency-contacts", emergencyContactController.listContacts);
router.post(
  "/emergency-contacts",
  validateBody(createEmergencyContactSchema),
  emergencyContactController.createContact,
);
router.patch(
  "/emergency-contacts/:id",
  validateParams(emergencyContactIdParamsSchema),
  validateBody(updateEmergencyContactSchema),
  emergencyContactController.updateContact,
);
router.delete(
  "/emergency-contacts/:id",
  validateParams(emergencyContactIdParamsSchema),
  emergencyContactController.deleteContact,
);

router.get(
  "/history",
  validateQuery(travelHistoryQuerySchema),
  historyController.listHistory,
);

export default router;
