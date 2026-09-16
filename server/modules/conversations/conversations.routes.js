import { Router } from "express";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as conversationsController from "./conversations.controller.js";
import {
  addMessageSchema,
  conversationIdParamsSchema,
  createConversationSchema,
  escalateConversationSchema,
  listConversationsQuerySchema,
  recordMessagesSchema,
} from "./conversations.validators.js";

const router = Router();

// Every conversation route requires an authenticated customer for now
// (anonymous threads are a future extension — see prisma/conversations.prisma).
router.use(requireAuth);

router.post("/", validateBody(createConversationSchema), conversationsController.create);

router.get("/", validateQuery(listConversationsQuerySchema), conversationsController.list);

router.get(
  "/:id",
  validateParams(conversationIdParamsSchema),
  conversationsController.getById,
);

router.post(
  "/:id/messages/record",
  validateParams(conversationIdParamsSchema),
  validateBody(recordMessagesSchema),
  conversationsController.recordMessages,
);

router.post(
  "/:id/messages",
  validateParams(conversationIdParamsSchema),
  validateBody(addMessageSchema),
  conversationsController.addMessage,
);

router.post(
  "/:id/escalate",
  validateParams(conversationIdParamsSchema),
  validateBody(escalateConversationSchema),
  conversationsController.escalate,
);

export default router;
