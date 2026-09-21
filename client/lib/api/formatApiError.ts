/**
 * Turn RTK Query / fetch errors into short, non-technical copy for the UI.
 * Never surface Prisma, SQL, stack traces, or raw HTTP dumps.
 */

const TECHNICAL_RE =
  /\b(prisma|postgres|sql|econnrefused|econnreset|etimedout|stack|invocation|column `|relation "|invalid\s+`|P20\d{2}|ENOENT|EADDRINUSE|TypeError|ReferenceError)\b/i;

const STATUS_DEFAULTS: Record<number, string> = {
  400: "Please check your details and try again.",
  401: "Incorrect email or password.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with something already saved.",
  413: "That request is too large. Try a smaller file.",
  422: "Please check your details and try again.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again.",
  502: "We're having trouble reaching our servers. Please try again.",
  503: "The service is temporarily unavailable. Please try again shortly.",
  504: "That took too long. Please try again.",
};

function isTechnical(message: string): boolean {
  return TECHNICAL_RE.test(message);
}

function pickServerMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  for (const key of ["message", "error"] as const) {
    const v = obj[key];
    if (typeof v === "string" && v.trim() && !isTechnical(v)) return v.trim();
  }
  return null;
}

/**
 * @param error RTK Query FetchBaseQueryError, Error, or unknown
 * @param fallback Shown when nothing safe is available
 */
export function formatApiError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    return isTechnical(error) ? fallback : error;
  }

  if (typeof error !== "object") return fallback;

  const err = error as {
    status?: number | string;
    originalStatus?: number;
    data?: unknown;
    error?: string;
    message?: string;
  };

  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.originalStatus === "number"
        ? err.originalStatus
        : undefined;

  const serverMsg = pickServerMessage(err.data);
  if (serverMsg) {
    // Prefer domain-specific server copy for known auth cases
    if (status === 403 && /verif/i.test(serverMsg)) return serverMsg;
    if (status === 401 && /credential|password|email/i.test(serverMsg)) {
      return "Incorrect email or password.";
    }
    return serverMsg;
  }

  if (status != null && STATUS_DEFAULTS[status]) {
    return STATUS_DEFAULTS[status];
  }

  if (err.status === "FETCH_ERROR" || err.error === "TypeError: Failed to fetch") {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (typeof err.message === "string" && err.message.trim() && !isTechnical(err.message)) {
    return err.message.trim();
  }

  return fallback;
}
