import { AppError } from "../../lib/customError.js";

const PUBLIC_BY_CODE = {
  STT_UNCONFIGURED: "Voice transcription is not configured on this environment.",
  STT_UNAVAILABLE: "Voice transcription is temporarily unavailable.",
  TTS_UNCONFIGURED: "Spoken replies are not configured on this environment.",
  TTS_UNAVAILABLE: "Spoken replies are temporarily unavailable.",
  VOICE_TELEPHONY_UNCONFIGURED: "Phone voice is not configured on this environment.",
  VOICE_TELEPHONY_UNAVAILABLE: "Phone voice is temporarily unavailable.",
  VOICE_UNSUPPORTED: "Voice is not available on this device or browser.",
  VOICE_MIC_DENIED: "Microphone permission was denied.",
  VOICE_SESSION_NOT_FOUND: "Voice session not found.",
  VOICE_OTP_INVALID: "That confirmation code is invalid or has expired.",
  VOICE_OTP_EXPIRED: "That confirmation code has expired. Request a new one.",
  VOICE_OTP_REQUIRED: "Confirm this booking with the one-time code sent to you.",
  VOICE_CONFIRMATION_REQUIRED: "Voice booking requires explicit confirmation and a one-time code.",
  VOICE_ACTION_BLOCKED: "That action cannot be completed from voice.",
  VOICE_UNAUTHENTICATED: "Sign in to use voice with your traveller account.",
};

export function publicVoiceMessage(code, fallback = "Voice is unavailable right now.") {
  return PUBLIC_BY_CODE[code] || fallback;
}

export function voiceError(status, code, fallback) {
  const err = new AppError(status, publicVoiceMessage(code, fallback));
  err.code = code;
  return err;
}

export function sanitizeVoiceFailure(err) {
  if (err instanceof AppError) {
    const code = err.code && PUBLIC_BY_CODE[err.code] ? err.code : null;
    if (code) {
      err.message = publicVoiceMessage(code);
      return err;
    }
    return err;
  }
  const code = err?.code && PUBLIC_BY_CODE[err.code] ? err.code : "VOICE_UNSUPPORTED";
  return voiceError(503, code);
}
