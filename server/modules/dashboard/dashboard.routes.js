import { Router } from "express";
import { validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requireAnyPermission } from "../../middlewares/permission.js";
import * as dashboardController from "./dashboard.controller.js";
import { dashboardQuerySchema } from "./dashboard.validators.js";

const router = Router();

router.use(requireAuth);
router.use(requireAnyPermission(["ops:dashboard:read", "dashboard:read"]));

router.get("/overview", validateQuery(dashboardQuerySchema), dashboardController.overview);
router.get("/sales", validateQuery(dashboardQuerySchema), dashboardController.sales);
router.get("/revenue", validateQuery(dashboardQuerySchema), dashboardController.revenue);
router.get("/margins", validateQuery(dashboardQuerySchema), dashboardController.margins);
router.get("/credit", validateQuery(dashboardQuerySchema), dashboardController.credit);
router.get("/funnel", validateQuery(dashboardQuerySchema), dashboardController.funnel);
router.get("/conversion", validateQuery(dashboardQuerySchema), dashboardController.conversion);
router.get("/automation", validateQuery(dashboardQuerySchema), dashboardController.automation);
router.get("/suppliers", validateQuery(dashboardQuerySchema), dashboardController.suppliers);
router.get("/customers", validateQuery(dashboardQuerySchema), dashboardController.customers);
router.get("/operational", validateQuery(dashboardQuerySchema), dashboardController.operational);
router.get(
  "/escalations/breakdown",
  validateQuery(dashboardQuerySchema),
  dashboardController.escalationsBreakdown,
);
router.get("/ava-guidance", validateQuery(dashboardQuerySchema), dashboardController.avaGuidance);

export default router;
