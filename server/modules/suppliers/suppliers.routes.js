import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth, requireAuthOrInternalKey } from "../../middlewares/auth.js";
import * as suppliersController from "./suppliers.controller.js";
import { createDemoSnapshot } from "./demoSnapshot.controller.js";
import { searchSchema } from "./suppliers.validators.js";
import { demoSnapshotSchema } from "./demoSnapshot.validators.js";

const router = Router();

router.post(
  "/search",
  requireAuthOrInternalKey,
  validateBody(searchSchema),
  suppliersController.search,
);

// requireAuth (not …OrInternalKey): the snapshot owner must be a real JWT
// subject, since the booking engine looks the row up by { id, userId }.
router.post(
  "/demo-snapshot",
  requireAuth,
  validateBody(demoSnapshotSchema),
  createDemoSnapshot,
);

export default router;
