import { AppError } from "../../lib/customError.js";
import { verifyAccessToken, verifyTempToken } from "../../lib/jwt.js";
import { successResponse } from "../../lib/response.js";
import * as authService from "./auth.service.js";
import {
  assertCookieAuthRequestAllowed,
  clearRefreshCookie,
  publicAuthSession,
  readRefreshTokenFromRequest,
  setRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "./auth.cookies.js";

function attachSessionCookies(req, res, session) {
  if (session?.refreshToken) {
    setRefreshCookie(res, session.refreshToken);
  }
  return publicAuthSession(session);
}

export async function register(req, res, next) {
  try {
    const data = await authService.registerUser(req.body, { req });
    return successResponse(res, "Registration initiated", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const data = await authService.verifyEmail(
      { email: req.body.email, code: req.body.code },
      { req },
    );
    return successResponse(res, "Email verified", attachSessionCookies(req, res, data));
  } catch (e) {
    next(e);
  }
}

export async function resendVerification(req, res, next) {
  try {
    const data = await authService.resendVerificationCode(
      { email: req.body.email },
      { req },
    );
    return successResponse(res, "Verification code sent", data);
  } catch (e) {
    next(e);
  }
}

export async function bootstrap(req, res, next) {
  try {
    const data = await authService.bootstrapFirstUser(req.body, { req });
    return successResponse(res, "Bootstrap complete", attachSessionCookies(req, res, data), 201);
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const data = await authService.loginUser(req.body, { req });
    if (data?.requires2fa) {
      return successResponse(res, data.message || "Two-factor authentication required", data);
    }
    return successResponse(res, "OK", attachSessionCookies(req, res, data));
  } catch (e) {
    next(e);
  }
}

async function resolve2faEnrollmentIdentity(req) {
  let userId = req.user?.id;
  if (userId) {
    return { userId, tempTokenUsed: false };
  }

  const bodyTempToken = req.body?.tempToken;
  const authHeader = req.headers.authorization;
  const rawBearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  try {
    if (bodyTempToken) {
      const payload = verifyTempToken(bodyTempToken, "2fa_enrollment");
      return { userId: payload.sub, tempTokenUsed: true };
    }

    if (rawBearerToken) {
      const payload = verifyAccessToken(rawBearerToken);
      if (!payload?.sub) {
        throw new AppError(401, "Invalid token");
      }
      if (payload.purpose) {
        if (payload.purpose === "2fa_enrollment") {
          return { userId: payload.sub, tempTokenUsed: true };
        }
        throw new AppError(401, "Invalid token purpose");
      }
      await authService.assertAccessTokenStillValid(payload.sub, payload);
      return { userId: payload.sub, tempTokenUsed: false };
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.message === "Invalid token purpose") {
      throw new AppError(401, "Invalid token purpose");
    }
    throw new AppError(401, "Invalid or expired token");
  }

  throw new AppError(401, "Authentication or enrollment token required");
}

export async function twoFactorSetup(req, res, next) {
  try {
    const { userId } = await resolve2faEnrollmentIdentity(req);
    const data = await authService.setupTwoFactor(userId, { req });
    return successResponse(res, "Two-factor authentication setup initiated", data);
  } catch (e) {
    next(e);
  }
}

export async function twoFactorConfirm(req, res, next) {
  try {
    const { userId, tempTokenUsed } = await resolve2faEnrollmentIdentity(req);
    const data = await authService.confirmTwoFactor(
      userId,
      { code: req.body.code },
      { req, tempTokenUsed },
    );
    if (data?.accessToken) {
      return successResponse(
        res,
        data.message || "Two-factor authentication enabled",
        attachSessionCookies(req, res, data),
      );
    }
    return successResponse(
      res,
      data.message || "Two-factor authentication enabled",
      data,
    );
  } catch (e) {
    next(e);
  }
}

export async function twoFactorVerify(req, res, next) {
  try {
    const tempToken = req.body?.tempToken || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const data = await authService.verifyTwoFactor(
      { tempToken, code: req.body.code, type: req.body.type },
      { req },
    );
    return successResponse(res, "Two-factor authentication verified", attachSessionCookies(req, res, data));
  } catch (e) {
    next(e);
  }
}

export async function twoFactorDisable(req, res, next) {
  try {
    const data = await authService.disableTwoFactor(
      req.user.id,
      { password: req.body.password, code: req.body.code },
      { req },
    );
    return successResponse(res, data.message, data);
  } catch (e) {
    next(e);
  }
}

export async function refresh(req, res, next) {
  try {
    const fromCookie = Boolean(req.cookies?.[REFRESH_COOKIE_NAME]);
    const refreshToken = readRefreshTokenFromRequest(req);
    assertCookieAuthRequestAllowed(req, { usedCookie: fromCookie && Boolean(refreshToken) });
    const data = await authService.refreshSession({ refreshToken }, { req });
    return successResponse(res, "OK", attachSessionCookies(req, res, data));
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res, next) {
  try {
    const fromCookie = Boolean(req.cookies?.[REFRESH_COOKIE_NAME]);
    const refreshToken = readRefreshTokenFromRequest(req);
    assertCookieAuthRequestAllowed(req, { usedCookie: fromCookie && Boolean(refreshToken) });
    await authService.logoutUser({ refreshToken }, { req });
    clearRefreshCookie(res);
    return successResponse(res, "Logged out", {});
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const data = await authService.getProfile(req.user.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const data = await authService.requestPasswordReset(
      { email: req.body.email },
      { req },
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const data = await authService.resetPasswordWithToken(
      { token: req.body.token, password: req.body.password },
      { req },
    );
    clearRefreshCookie(res);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listSessions(req, res, next) {
  try {
    const data = await authService.listSessions(req.user.id, {
      currentSessionId: req.query?.currentSessionId,
      refreshToken: readRefreshTokenFromRequest(req),
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function revokeSession(req, res, next) {
  try {
    const data = await authService.revokeSession(req.user.id, req.params.id, {
      req,
    });
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function revokeOtherSessions(req, res, next) {
  try {
    const data = await authService.revokeOtherSessions(
      req.user.id,
      {
        currentSessionId: req.body?.currentSessionId,
        refreshToken: readRefreshTokenFromRequest(req),
      },
      { req },
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
