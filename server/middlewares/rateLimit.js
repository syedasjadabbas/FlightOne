import rateLimit from "express-rate-limit";

function rateLimitDisabled() {
  if (process.env.RATE_LIMIT_ENABLED === "false") return true;
  const env = process.env.NODE_ENV || "development";
  if (env !== "production" && process.env.RATE_LIMIT_IN_DEV !== "true") {
    return true;
  }
  return false;
}

function requestPath(req) {
  return req.originalUrl?.split("?")[0] || req.path || "";
}

function isAuthApiRoute(req) {
  return requestPath(req).startsWith("/api/v1/auth");
}

function rateLimitHandler(req, res, next, options) {
  const retryAfterSec = Math.ceil(options.windowMs / 1000);
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(options.statusCode).json({
    success: false,
    message: "Too many requests",
    code: "RATE_LIMITED",
  });
}

const rateLimitSkip = () => rateLimitDisabled();

/** Per email+IP so one office NAT does not block every user. */
export const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkip,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const ip = req.ip || "unknown";
    return email ? `login:${ip}:${email}` : `login:${ip}`;
  },
});

export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkip,
  handler: rateLimitHandler,
});

export const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => rateLimitDisabled() || isAuthApiRoute(req),
  handler: rateLimitHandler,
});
