/** Client helpers for device/session management UI states. */

export type SessionsUiState =
  | "loading"
  | "error"
  | "empty"
  | "ready"
  | "success_revoke"
  | "success_revoke_others";

export function sessionsUiState(opts: {
  isLoading: boolean;
  isError: boolean;
  sessionCount: number;
  justRevoked?: boolean;
  justRevokedOthers?: boolean;
}): SessionsUiState {
  if (opts.isLoading) return "loading";
  if (opts.isError) return "error";
  if (opts.justRevokedOthers) return "success_revoke_others";
  if (opts.justRevoked) return "success_revoke";
  if (opts.sessionCount === 0) return "empty";
  return "ready";
}

export function formatSessionWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function sessionHasTokenLeak(payload: unknown): boolean {
  const raw = JSON.stringify(payload ?? {});
  return (
    raw.includes("tokenHash") ||
    /"refreshToken"\s*:/.test(raw) ||
    raw.includes("passwordHash")
  );
}
