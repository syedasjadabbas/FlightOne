import { AppError } from "../lib/customError.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { getEffectivePermissions } from "../lib/permissions.service.js";
import { assertAccessTokenStillValid } from "../modules/auth/auth.service.js";

/**
 * Allow either a user JWT or a shared internal API key (Next.js → API).
 * Header: `X-Internal-Api-Key: <INTERNAL_API_KEY>`
 */
export function requireAuthOrInternalKey(req, _res, next) {
  const internalKey = process.env.INTERNAL_API_KEY;
  const provided = req.headers["x-internal-api-key"];
  if (internalKey && provided && provided === internalKey) {
    req.user = { id: "internal", email: "internal@flightone.local" };
    req.permissions = new Set(["*"]);
    req.authMode = "internal";
    return next();
  }
  return requireAuth(req, _res, next);
}

export function optionalAuth(req, _res, next) {
  req.user = undefined;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next();
  }
  const raw = header.slice(7);
  try {
    if (!process.env.JWT_SECRET) {
      return next();
    }
    const payload = verifyAccessToken(raw);
    if (payload?.sub) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        mfa: Boolean(payload.mfa),
      };
    }
  } catch {
    // ignore invalid optional token
  }
  next();
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }
  const raw = header.slice(7);
  try {
    if (!process.env.JWT_SECRET) {
      return next(new AppError(503, "Authentication is not configured"));
    }
    const payload = verifyAccessToken(raw);
    if (!payload?.sub) {
      return next(new AppError(401, "Invalid token"));
    }
    await assertAccessTokenStillValid(payload.sub, payload);
    req.user = {
      id: payload.sub,
      email: payload.email,
      mfa: Boolean(payload.mfa),
    };
    req.permissions = await getEffectivePermissions(req.user.id);
    next();
  } catch (e) {
    if (e instanceof AppError) return next(e);
    next(new AppError(401, "Invalid or expired token"));
  }
}
