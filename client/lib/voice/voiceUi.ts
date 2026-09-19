export type VoiceUiState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "confirmation_required"
  | "completed"
  | "failed"
  | "unavailable";

const SESSION_TO_UI: Record<string, VoiceUiState> = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
  CONFIRMATION_REQUIRED: "confirmation_required",
  COMPLETED: "completed",
  FAILED: "failed",
  UNAVAILABLE: "unavailable",
};

export function mapVoiceSessionState(state: string | null | undefined): VoiceUiState {
  if (!state) return "idle";
  return SESSION_TO_UI[state] || "idle";
}

export function isBrowserVoiceSupported(
  speechRecognition: unknown,
  mediaDevices: unknown,
): boolean {
  return Boolean(speechRecognition) && Boolean(mediaDevices);
}

export function voiceStatusLabel(
  state: VoiceUiState,
  opts: { micDenied?: boolean; unsupported?: boolean; unauthenticated?: boolean } = {},
): string {
  if (opts.unauthenticated) return "Sign in to talk with Ava";
  if (opts.unsupported) return "Voice is not available on this device";
  if (opts.micDenied) return "Microphone permission was denied";
  switch (state) {
    case "listening":
      return "Listening…";
    case "processing":
      return "Working on that…";
    case "speaking":
      return "Ava is speaking…";
    case "confirmation_required":
      return "Confirm with a one-time code to continue this booking";
    case "completed":
      return "Voice request complete";
    case "failed":
      return "Voice could not complete that request";
    case "unavailable":
      return "Voice is unavailable right now";
    default:
      return "Tap to talk with Ava";
  }
}

const RAW_ERROR = /econnrefused|etimedout|socket|prisma|stack|api[_-]?key|secret|twilio|fetch failed/i;

export function sanitizeVoiceClientError(message: unknown): string {
  const raw = typeof message === "string" ? message : "";
  if (!raw || RAW_ERROR.test(raw)) {
    return "Voice is unavailable right now. Nothing was booked.";
  }
  return raw;
}
