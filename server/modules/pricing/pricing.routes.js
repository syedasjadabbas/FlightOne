import { Router } from "express";
import { validateBody, validateQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as pricingController from "./pricing.controller.js";
import { priceOfferBodySchema, priceOfferQuerySchema } from "./pricing.validators.js";

const router = Router();

router.use(requireAuth);

// POST preferred (body is the natural shape for this payload) — GET with a
// validated query is also supported for simple search-UI callers.
router.post("/quote", validateBody(priceOfferBodySchema), pricingController.quote);
router.get("/quote", validateQuery(priceOfferQuerySchema), pricingController.quote);

router.post("/reprice", validateBody(priceOfferBodySchema), pricingController.reprice);

export default router;
