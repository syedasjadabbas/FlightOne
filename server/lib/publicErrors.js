/**
 * Never expose Prisma / stack / SQL internals to API clients.
 * AppError messages are trusted (authored by us); everything else is sanitized.
 */
import { AppError } from "./customError.js";
import { errorResponse } from "./response.js";

const TECHNICAL_RE =
  /\b(prisma|postgres|sql|econnrefused|econnreset|etimedout|stack|invocation|column `|relation "|invalid\s+`|P20\d{2}|ENOENT|EADDRINUSE)\b/i;

export function isTechnicalErrorMessage(message) {
  if (typeof message !== "string" || !message.trim()) return true;
  return TECHNICAL_RE.test(message);
}

export function publicErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (err instanceof AppError) {
    const msg = err.message?.trim();
    if (msg && !isTechnicalErrorMessage(msg)) return msg;
    return fallback;
  }

  const code = err?.code;
  if (code === "P2002") {
    const target = err.meta?.target;
    if (Array.isArray(target) && target.includes("email")) {
      return "That email is already registered. Try signing in instead.";
    }
    return "That record already exists.";
  }
  if (code === "P2025") return "We couldn't find what you were looking for.";
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return "We're having trouble reaching our servers. Please try again in a moment.";
  }

  if (err?.type === "entity.too.large" || err?.name === "PayloadTooLargeError") {
    return "That request is too large. Try a smaller file or payload.";
  }

  const status = typeof err?.status === "number" ? err.status : undefined;
  if (status === 400) return "Please check your details and try again.";
  if (status === 401) return "Please sign in again to continue.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That conflicts with an existing record.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";

  const raw = typeof err?.message === "string" ? err.message.trim() : "";
  if (raw && !isTechnicalErrorMessage(raw) && status != null && status < 500) {
    return raw;
  }

  return fallback;
}

export function sendExpressErrorResponse(err, req, res) {
  if (err instanceof AppError) {
    const extra = {};
    if (err.code) extra.code = err.code;
    const details =
      err.details && typeof err.details === "object" ? err.details : null;
    if (details) Object.assign(extra, details);
    return errorResponse(
      res,
      publicErrorMessage(err, err.message || "Request failed"),
      Object.keys(extra).length ? extra : null,
      err.statusCode,
    );
  }

  if (err?.code === "P2002") {
    return errorResponse(res, publicErrorMessage(err), null, 409);
  }
  if (err?.code === "P2025") {
    return errorResponse(res, publicErrorMessage(err), null, 404);
  }
  if (
    err?.type === "entity.too.large" ||
    err?.name === "PayloadTooLargeError"
  ) {
    return errorResponse(res, publicErrorMessage(err), { code: "PAYLOAD_TOO_LARGE" }, 413);
  }

  const status =
    typeof err?.status === "number" && err.status >= 400 && err.status < 600
      ? err.status
      : 500;

  // Always hide internals — never echo Prisma / stack to clients (even in development).
  return errorResponse(res, publicErrorMessage(err), null, status);
}
