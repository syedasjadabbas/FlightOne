import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import * as c from "./newsletter.controller.js";
import { subscribeBodySchema } from "./newsletter.validators.js";

const router = Router();

router.post("/subscribe", validateBody(subscribeBodySchema), c.subscribe);

export default router;
