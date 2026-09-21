import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuthOrInternalKey } from "../../middlewares/auth.js";
import * as llmController from "./llm.controller.js";
import { completionRequestSchema } from "./llm.validators.js";

const router = Router();

router.get("/providers", requireAuthOrInternalKey, llmController.providers);

router.post(
  "/complete",
  requireAuthOrInternalKey,
  validateBody(completionRequestSchema),
  llmController.complete,
);

router.post(
  "/complete/stream",
  requireAuthOrInternalKey,
  validateBody(completionRequestSchema),
  llmController.completeStream,
);

export default router;
