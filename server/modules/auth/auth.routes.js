import { Router } from "express";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import { authLimiter, loginLimiter } from "../../middlewares/rateLimit.js";
import * as authController from "./auth.controller.js";
import {
  bootstrapSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  revokeOtherSessionsSchema,
  verifyEmailSchema,
} from "./auth.validators.js";

const router = Router();

router.post(
  "/bootstrap",
  authLimiter,
  validateBody(bootstrapSchema),
  authController.bootstrap,
);

router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  authController.register,
);

router.post(
  "/verify-email",
  authLimiter,
  validateBody(verifyEmailSchema),
  authController.verifyEmail,
);

router.post(
  "/resend-verification",
  loginLimiter,
  validateBody(resendVerificationSchema),
  authController.resendVerification,
);

router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  authController.login,
);

router.post(
  "/forgot-password",
  loginLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

router.post(
  "/refresh",
  authLimiter,
  validateBody(refreshSchema),
  authController.refresh,
);

router.post("/logout", validateBody(logoutSchema), authController.logout);

router.get("/me", requireAuth, authController.me);

router.get("/sessions", requireAuth, authController.listSessions);

router.delete("/sessions/:id", requireAuth, authController.revokeSession);

router.post(
  "/sessions/revoke-others",
  requireAuth,
  authLimiter,
  validateBody(revokeOtherSessionsSchema),
  authController.revokeOtherSessions,
);

export default router;
