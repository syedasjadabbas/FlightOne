import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuthOrInternalKey } from "../../middlewares/auth.js";
import * as suppliersController from "./suppliers.controller.js";
import { searchSchema } from "./suppliers.validators.js";

const router = Router();

router.post(
  "/search",
  requireAuthOrInternalKey,
  validateBody(searchSchema),
  suppliersController.search,
);

export default router;
