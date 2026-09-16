import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as meController from "./me.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", meController.me);
router.get("/permissions", meController.permissions);

export default router;
