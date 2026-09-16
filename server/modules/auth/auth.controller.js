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
    return successResponse(res, "OK", attachSessionCookies(req, res, data));
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
