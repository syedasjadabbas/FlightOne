import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyVoiceIntent } from "./voice.intents.js";
import { getVoiceCapability } from "./voice.providers.js";
import { publicVoiceMessage, sanitizeVoiceFailure } from "./voice.errors.js";
import { AppError } from "../../lib/customError.js";

describe("voice intents + capability", () => {
  it("requires confirmation for booking intent and does not auto-ticket", () => {
    const intent = classifyVoiceIntent("Yes, book this flight for me");
    assert.equal(intent.kind, "BOOKING");
    assert.equal(intent.requiresConfirmation, true);
    assert.equal(intent.irreversible, true);
    assert.equal(intent.blocked, false);
  });

  it("blocks cancel, refund, reissue, and ticketing from voice", () => {
    assert.equal(classifyVoiceIntent("Cancel my flight").blocked, true);
    assert.equal(classifyVoiceIntent("I want a refund").kind, "REFUND");
    assert.equal(classifyVoiceIntent("Please reissue the ticket").blocked, true);
    assert.equal(classifyVoiceIntent("Issue the ticket now").blocked, true);
  });

  it("defaults phone telephony to unconfigured and never invents live calls", () => {
    const cap = getVoiceCapability({ VOICE_TELEPHONY_PROVIDER: "unconfigured" });
    assert.equal(cap.phone.configured, false);
    assert.equal(cap.phone.available, false);
    assert.equal(cap.bookingConfirmation.requiresOtp, true);
    assert.ok(cap.reasons.some((r) => /phone voice is unconfigured/i.test(r)));
  });

  it("does not expose raw provider errors", () => {
    const wrapped = sanitizeVoiceFailure(new Error("ECONNREFUSED twilio api_key=secret"));
    assert.equal(wrapped instanceof AppError, true);
    assert.equal(wrapped.message.includes("api_key"), false);
    assert.equal(wrapped.message.includes("ECONNREFUSED"), false);
    assert.match(publicVoiceMessage("VOICE_TELEPHONY_UNCONFIGURED"), /not configured/i);
  });
});
