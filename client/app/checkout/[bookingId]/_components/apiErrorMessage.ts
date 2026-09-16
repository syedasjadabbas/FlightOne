export function apiErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Something went wrong";
  const e = err as {
    data?: { message?: string; code?: string };
    error?: string;
    status?: number;
  };
  return e.data?.message || e.error || `Request failed (${e.status ?? "?"})`;
}
