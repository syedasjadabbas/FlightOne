import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middlewares/auth.js";
import { validateBody, validateParams, validateQuery } from "../../lib/validate.js";
import * as rewardsController from "./rewards.controller.js";
import {
  attachReferralSchema,
  checkoutCreditSchema,
  companyIdParamsSchema,
  ledgerEntryIdParamsSchema,
  listLedgerQuerySchema,
  redeemPointsSchema,
  upsertCorporateProgramSchema,
} from "./rewards.validators.js";

const router = Router();

router.get("/policy", optionalAuth, rewardsController.getPolicy);

router.use(requireAuth);
router.get("/", rewardsController.getSummary);
router.get("/ledger", validateQuery(listLedgerQuerySchema), rewardsController.listLedger);
router.get(
  "/ledger/:entryId",
  validateParams(ledgerEntryIdParamsSchema),
  rewardsController.getLedgerEntry,
);
router.get("/referrals", rewardsController.listReferrals);
router.post("/redeem", validateBody(redeemPointsSchema), rewardsController.redeem);
router.post(
  "/checkout-credit",
  validateBody(checkoutCreditSchema),
  rewardsController.checkoutCredit,
);
router.post(
  "/referrals/attach",
  validateBody(attachReferralSchema),
  rewardsController.attachReferral,
);
router.get(
  "/corporate/:companyId",
  validateParams(companyIdParamsSchema),
  rewardsController.getCorporateProgram,
);
router.put(
  "/corporate/:companyId",
  validateParams(companyIdParamsSchema),
  validateBody(upsertCorporateProgramSchema),
  rewardsController.upsertCorporateProgram,
);

export default router;
