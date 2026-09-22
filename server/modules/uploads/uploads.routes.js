import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as c from "./uploads.controller.js";
import { signUploadBodySchema } from "./uploads.validators.js";

const router = Router();

router.use(requireAuth);
router.post("/sign", validateBody(signUploadBodySchema), c.signUpload);

export default router;
