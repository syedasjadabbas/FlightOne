/** Client-side password recovery helpers (forgot / reset forms). */

export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateForgotPasswordEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Please enter your email address.";
  if (!isValidEmail(trimmed)) return "Please enter a valid email address.";
  return null;
}

export function validateResetPasswordInput(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): "missing_token" | "weak_password" | "mismatch" | null {
  if (!input.token.trim()) return "missing_token";
  if (input.password.length < MIN_PASSWORD_LENGTH) return "weak_password";
  if (input.password !== input.confirmPassword) return "mismatch";
  return null;
}

export type ForgotUiState =
  | "idle"
  | "loading"
  | "success_queued"
  | "success_unconfigured"
  | "error";

export function forgotPasswordUiState(opts: {
  isLoading: boolean;
  submitted: boolean;
  emailDelivery?: "QUEUED" | "UNCONFIGURED" | null;
  hasError: boolean;
}): ForgotUiState {
  if (opts.isLoading) return "loading";
  if (opts.hasError) return "error";
  if (opts.submitted && opts.emailDelivery === "QUEUED") return "success_queued";
  if (opts.submitted && opts.emailDelivery === "UNCONFIGURED") {
    return "success_unconfigured";
  }
  if (opts.submitted) return "success_queued";
  return "idle";
}

export type ResetUiState =
  | "idle"
  | "loading"
  | "success"
  | "invalid_token"
  | "error"
  | "missing_token";

export function resetPasswordUiState(opts: {
  token: string;
  isLoading: boolean;
  succeeded: boolean;
  errorStatus?: number | null;
  hasError: boolean;
}): ResetUiState {
  if (!opts.token.trim()) return "missing_token";
  if (opts.isLoading) return "loading";
  if (opts.succeeded) return "success";
  if (opts.hasError && opts.errorStatus === 400) return "invalid_token";
  if (opts.hasError) return "error";
  return "idle";
}
