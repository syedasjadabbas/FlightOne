import { describe, expect, it } from "vitest";
import {
  isBrowserVoiceSupported,
  mapVoiceSessionState,
  sanitizeVoiceClientError,
  voiceStatusLabel,
} from "@/lib/voice/voiceUi";

describe("voiceUi", () => {
  it("maps session states including confirmation and unavailable", () => {
    expect(mapVoiceSessionState("IDLE")).toBe("idle");
    expect(mapVoiceSessionState("LISTENING")).toBe("listening");
    expect(mapVoiceSessionState("CONFIRMATION_REQUIRED")).toBe("confirmation_required");
    expect(mapVoiceSessionState("UNAVAILABLE")).toBe("unavailable");
  });

  it("handles permission denial and unsupported browsers", () => {
    expect(isBrowserVoiceSupported(undefined, {})).toBe(false);
    expect(isBrowserVoiceSupported({}, {})).toBe(true);
    expect(voiceStatusLabel("idle", { micDenied: true })).toMatch(/denied/i);
    expect(voiceStatusLabel("idle", { unsupported: true })).toMatch(/not available/i);
    expect(voiceStatusLabel("idle", { unauthenticated: true })).toMatch(/sign in/i);
  });

  it("never surfaces raw provider errors", () => {
    expect(sanitizeVoiceClientError("ECONNREFUSED 127.0.0.1:9")).toMatch(/unavailable/i);
    expect(sanitizeVoiceClientError("Twilio api_key invalid")).toMatch(/unavailable/i);
    expect(sanitizeVoiceClientError("PrismaClientKnownRequestError")).toMatch(/unavailable/i);
  });
});
