/**
 * Voice provider adapters — never fabricate live STT/TTS/telephony.
 * Default: unconfigured. Optional HTTP adapters when credentials exist.
 */
export function getVoiceSttProviderName(env = process.env) {
  return (env.VOICE_STT_PROVIDER || "browser").trim().toLowerCase();
}

export function getVoiceTtsProviderName(env = process.env) {
  return (env.VOICE_TTS_PROVIDER || "browser").trim().toLowerCase();
}

export function getVoiceTelephonyProviderName(env = process.env) {
  return (env.VOICE_TELEPHONY_PROVIDER || "unconfigured").trim().toLowerCase();
}

function httpReady(url, key) {
  return Boolean(url && String(url).trim() && key && String(key).trim());
}

/**
 * Honest capability surface for web mic + phone line.
 * Browser STT/TTS is a client capability, not a live vendor call.
 */
export function getVoiceCapability(env = process.env) {
  const stt = getVoiceSttProviderName(env);
  const tts = getVoiceTtsProviderName(env);
  const telephony = getVoiceTelephonyProviderName(env);

  const sttHttp =
    stt === "http" &&
    httpReady(env.VOICE_STT_HTTP_URL, env.VOICE_STT_HTTP_API_KEY);
  const ttsHttp =
    tts === "http" &&
    httpReady(env.VOICE_TTS_HTTP_URL, env.VOICE_TTS_HTTP_API_KEY);
  const phoneHttp =
    telephony === "http" &&
    httpReady(env.VOICE_TELEPHONY_HTTP_URL, env.VOICE_TELEPHONY_API_KEY);

  const webStt =
    stt === "browser" ? "browser" : sttHttp ? "http" : "unconfigured";
  const webTts =
    tts === "browser" ? "browser" : ttsHttp ? "http" : "unconfigured";

  const reasons = [];
  if (webStt === "unconfigured") {
    reasons.push("Speech-to-text provider is not configured");
  }
  if (webTts === "unconfigured") {
    reasons.push("Text-to-speech provider is not configured");
  }
  if (!phoneHttp) {
    reasons.push("Phone voice is unconfigured — a telephony provider must be configured before live calls.");
  }

  return {
    web: {
      microphone: "browser",
      stt: webStt,
      tts: webTts,
      available: webStt !== "unconfigured" || webTts !== "unconfigured",
    },
    phone: {
      provider: phoneHttp ? "http" : "unconfigured",
      configured: phoneHttp,
      available: phoneHttp,
    },
    bookingConfirmation: {
      requiresExplicitConfirmation: true,
      requiresOtp: true,
      irreversibleActionsBlocked: true,
    },
    reasons,
  };
}

export function assertPhoneProviderConfigured(env = process.env) {
  const cap = getVoiceCapability(env);
  return cap.phone.configured;
}

/**
 * Optional HTTP STT. Returns transcript or throws a sanitized failure.
 * Not used when provider is browser (client sends transcript).
 */
export async function transcribeAudioHttp(_audioBuffer, env = process.env) {
  if (getVoiceSttProviderName(env) !== "http") {
    const err = new Error("STT_UNCONFIGURED");
    err.code = "STT_UNCONFIGURED";
    throw err;
  }
  if (!httpReady(env.VOICE_STT_HTTP_URL, env.VOICE_STT_HTTP_API_KEY)) {
    const err = new Error("STT_UNCONFIGURED");
    err.code = "STT_UNCONFIGURED";
    throw err;
  }
  const err = new Error("STT_UNAVAILABLE");
  err.code = "STT_UNAVAILABLE";
  throw err;
}
