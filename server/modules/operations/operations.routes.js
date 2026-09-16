import { Router } from "express";
import { validateBody, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermission } from "../../middlewares/permission.js";
import * as operationsController from "./operations.controller.js";
import {
  createReconciliationSchema,
  drainOutboxSchema,
  listAccountingQuerySchema,
  listAuditQuerySchema,
  listCommissionsQuerySchema,
  listFinanceQuerySchema,
  listOutboxQuerySchema,
  listReconciliationQuerySchema,
  retryOutboxSchema,
} from "./operations.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/overview", requirePermission("ops:dashboard:read"), operationsController.overview);
router.get(
  "/integrations",
  requirePermission("ops:dashboard:read"),
  operationsController.integrations,
);

router.post(
  "/outbox/drain",
  requirePermission("ops:reconcile:write"),
  validateBody(drainOutboxSchema),
  operationsController.drainOutbox,
);

router.post(
  "/outbox/retry",
  requirePermission("ops:reconcile:write"),
  validateBody(retryOutboxSchema),
  operationsController.retryOutbox,
);

router.get(
  "/outbox",
  requirePermission("ops:events:read"),
  validateQuery(listOutboxQuerySchema),
  operationsController.listOutbox,
);

router.get(
  "/accounting",
  requirePermission("ops:dashboard:read"),
  validateQuery(listAccountingQuerySchema),
  operationsController.listAccounting,
);

router.get(
  "/finance",
  requirePermission("ops:dashboard:read"),
  validateQuery(listFinanceQuerySchema),
  operationsController.finance,
);

router.get(
  "/commissions",
  requirePermission("ops:dashboard:read"),
  validateQuery(listCommissionsQuerySchema),
  operationsController.listCommissions,
);

router.post(
  "/reconcile",
  requirePermission("ops:reconcile:write"),
  validateBody(createReconciliationSchema),
  operationsController.reconcile,
);

router.get(
  "/reconcile",
  requirePermission("ops:dashboard:read"),
  validateQuery(listReconciliationQuerySchema),
  operationsController.listReconciliation,
);

router.get(
  "/audit",
  requirePermission("ops:dashboard:read"),
  validateQuery(listAuditQuerySchema),
  operationsController.listAudit,
);

router.get("/ava-guidance", operationsController.avaGuidance);

export default router;
