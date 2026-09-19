/**
 * Phase 3 Voice AI — same conversation engine + booking/OTP guardrails.
 * Never tickets, pays, cancels, refunds, or reissues from conversational intent.
 */
import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { sha256Hex } from "../../lib/crypto.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import * as conversationsService from "../conversations/conversations.service.js";
import * as bookingsService from "../bookings/bookings.service.js";
import { getAvaJourneyContext } from "../journey/journey.service.js";
import { classifyVoiceIntent, publicIntentReply } from "./voice.intents.js";
import { getVoiceCapability, assertPhoneProviderConfigured } from "./voice.providers.js";
import { publicVoiceMessage, voiceError } from "./voice.errors.js";

const SESSION_SELECT = {
  id: true,
  userId: true,
  conversationId: true,
  channel: true,
  state: true,
  locale: true,
  lastErrorCode: true,
  createdAt: true,
  updatedAt: true,
};

const INTENT_SELECT = {
  id: true,
  sessionId: true,
  userId: true,
  status: true,
  supplierOfferSnapshotId: true,
  product: true,
  currency: true,
  amountMinor: true,
  bookingId: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
};

const OTP_TTL_MS = 10 * 60 * 1000;
const INTENT_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

let otpGenerator = defaultOtpGenerator;

function defaultOtpGenerator() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function setVoiceOtpGeneratorForTests(fn) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setVoiceOtpGeneratorForTests is only allowed when NODE_ENV=test");
  }
  otpGenerator = typeof fn === "function" ? fn : defaultOtpGenerator;
}

export function resetVoiceOtpGeneratorForTests() {
  otpGenerator = defaultOtpGenerator;
}

function hashPhone(e164) {
  const normalized = String(e164 || "").replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+") || normalized.length < 8) {
    throw new AppError(400, "Enter a valid international phone number");
  }
  return sha256Hex(normalized);
}

function publicSession(row, extras = {}) {
  if (!row) return row;
  return {
    id: row.id,
    conversationId: row.conversationId,
    channel: row.channel,
    state: row.state,
    locale: row.locale,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  };
}

async function audit(userId, action, resourceType, resourceId, metadata) {
  await writeAudit({ userId, action, resourceType, resourceId, metadata }).catch(() => {});
}

async function ownedSessionOrThrow(userId, sessionId) {
  const row = await prisma.voiceSession.findUnique({
    where: { id: sessionId },
    select: SESSION_SELECT,
  });
  if (!row || row.userId !== userId) {
    throw voiceError(404, "VOICE_SESSION_NOT_FOUND");
  }
  return row;
}

async function travellerContextLines(userId) {
  const lines = [];
  try {
    const profile = await prisma.travellerProfile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        preferredCabin: true,
        seatPref: true,
        mealPref: true,
        preferredAirlines: true,
      },
    });
    if (profile) {
      lines.push(
        `Traveller: ${profile.displayName || "signed-in"}. Cabin ${profile.preferredCabin || "unset"}; seat ${profile.seatPref || "unset"}.`,
      );
    }
  } catch {
    // profile is optional context
  }
  try {
    const journey = await getAvaJourneyContext(userId);
    if (journey?.promptBlock) lines.push(String(journey.promptBlock).slice(0, 800));
  } catch {
    // journey context is optional
  }
  return lines;
}

async function runConversationEngine(userId, conversationId, transcript) {
  let convId = conversationId;
  if (!convId) {
    const created = await conversationsService.createConversation(userId, {
      title: "Voice with Ava",
    });
    convId = created.id;
  }
  const result = await conversationsService.addMessage(userId, convId, transcript);
  return { conversationId: convId, ...result };
}

export function getCapability() {
  return getVoiceCapability();
}

export async function createWebSession(userId, { conversationId, locale } = {}) {
  if (!userId) throw voiceError(401, "VOICE_UNAUTHENTICATED");
  if (conversationId) {
    await conversationsService.getConversationById(userId, conversationId);
  }
  const session = await prisma.voiceSession.create({
    data: {
      userId,
      conversationId: conversationId || null,
      channel: "WEB",
      state: "IDLE",
      locale: locale || "en",
    },
    select: SESSION_SELECT,
  });
  await audit(userId, "voice.session.create", "VoiceSession", session.id, {
    channel: "WEB",
  });
  return publicSession(session, { capability: getVoiceCapability() });
}

export async function getSession(userId, sessionId) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  return publicSession(session, { capability: getVoiceCapability() });
}

export async function bindCaller(userId, { phone }) {
  if (!userId) throw voiceError(401, "VOICE_UNAUTHENTICATED");
  const phoneHash = hashPhone(phone);
  const row = await prisma.voiceCallerBinding.upsert({
    where: { userId_phoneHash: { userId, phoneHash } },
    update: {},
    create: { userId, phoneHash },
    select: { id: true, createdAt: true },
  });
  await audit(userId, "voice.caller.bind", "VoiceCallerBinding", row.id, {
    bound: true,
  });
  return { id: row.id, bound: true, createdAt: row.createdAt };
}

export async function processTurn(userId, sessionId, { transcript, persistConversation = true }) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  const text = typeof transcript === "string" ? transcript.trim() : "";
  if (!text) throw new AppError(400, "Transcript is required");

  await prisma.voiceSession.update({
    where: { id: session.id },
    data: { state: "PROCESSING" },
  });

  const intent = classifyVoiceIntent(text);
  const travellerContext = await travellerContextLines(userId);
  let conversationId = session.conversationId;
  let assistantContent = null;
  let userMessage = null;
  let assistantMessage = null;

  if (persistConversation) {
    try {
      const conv = await runConversationEngine(userId, conversationId, text);
      conversationId = conv.conversationId;
      userMessage = conv.userMessage;
      assistantMessage = conv.assistantMessage;
      assistantContent = conv.assistantMessage?.content || null;
    } catch {
      assistantContent = publicVoiceMessage("VOICE_UNSUPPORTED", "Ava could not complete that turn.");
    }
  }

  const reply = publicIntentReply(intent, assistantContent || "How can I help with your trip?");
  let state = "SPEAKING";
  if (intent.kind === "BOOKING") state = "CONFIRMATION_REQUIRED";
  if (intent.blocked) state = "FAILED";

  const updated = await prisma.voiceSession.update({
    where: { id: session.id },
    data: {
      state,
      conversationId,
      lastErrorCode: intent.blocked ? "VOICE_ACTION_BLOCKED" : null,
      metadata: {
        lastIntent: intent.kind,
        hasTravellerContext: travellerContext.length > 0,
      },
    },
    select: SESSION_SELECT,
  });

  await audit(userId, "voice.turn", "VoiceSession", session.id, {
    intent: intent.kind,
    requiresConfirmation: intent.requiresConfirmation,
    blocked: intent.blocked,
    persistConversation: Boolean(persistConversation),
  });

  return {
    session: publicSession(updated),
    intent: {
      kind: intent.kind,
      requiresConfirmation: intent.requiresConfirmation,
      blocked: intent.blocked,
      irreversible: intent.irreversible,
      reason: intent.reason || null,
    },
    reply,
    userMessage: userMessage
      ? { id: userMessage.id, role: userMessage.role, content: text }
      : null,
    assistantMessage: assistantMessage
      ? { id: assistantMessage.id, role: assistantMessage.role, content: reply }
      : { role: "ASSISTANT", content: reply },
    booking: intent.kind === "BOOKING"
      ? {
          confirmationRequired: true,
          otpRequired: true,
          booked: false,
          ticketed: false,
        }
      : { booked: false, ticketed: false },
  };
}

export async function prepareVoiceBooking(userId, sessionId, body) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  const snapshotId = body?.supplierOfferSnapshotId;
  if (!snapshotId) {
    throw new AppError(400, "A live offer reference is required before voice booking confirmation");
  }

  const snapshot = await prisma.supplierOfferSnapshot.findFirst({
    where: { id: snapshotId, userId },
    select: {
      id: true,
      product: true,
      currency: true,
      netMinor: true,
      expiresAt: true,
    },
  });
  if (!snapshot) throw new AppError(404, "Offer not found for this traveller");
  if (snapshot.expiresAt && snapshot.expiresAt < new Date()) {
    throw new AppError(409, "Quote expired — request a new quote before confirming");
  }

  const intent = await prisma.voiceBookingIntent.create({
    data: {
      sessionId: session.id,
      userId,
      status: "PENDING_CONFIRMATION",
      supplierOfferSnapshotId: snapshot.id,
      product: snapshot.product,
      currency: snapshot.currency,
      amountMinor: snapshot.netMinor,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      metadata: {
        confirmationRequired: true,
        otpRequired: true,
      },
    },
    select: INTENT_SELECT,
  });

  await prisma.voiceSession.update({
    where: { id: session.id },
    data: { state: "CONFIRMATION_REQUIRED" },
  });

  await audit(userId, "voice.booking.prepare", "VoiceBookingIntent", intent.id, {
    sessionId: session.id,
    snapshotId: snapshot.id,
    booked: false,
  });

  return {
    intent: {
      id: intent.id,
      status: intent.status,
      confirmationRequired: true,
      otpRequired: true,
      booked: false,
      ticketed: false,
      expiresAt: intent.expiresAt,
    },
    message: publicVoiceMessage("VOICE_CONFIRMATION_REQUIRED"),
  };
}

export async function requestVoiceBookingOtp(userId, sessionId, { intentId } = {}) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  const intent = await prisma.voiceBookingIntent.findFirst({
    where: {
      id: intentId,
      sessionId: session.id,
      userId,
    },
    select: INTENT_SELECT,
  });
  if (!intent) throw new AppError(404, "Voice booking confirmation not found");
  if (intent.status === "CONFIRMED") {
    throw new AppError(409, "This booking confirmation is already complete");
  }
  if (intent.expiresAt < new Date()) {
    await prisma.voiceBookingIntent.update({
      where: { id: intent.id },
      data: { status: "EXPIRED" },
    });
    throw voiceError(410, "VOICE_OTP_EXPIRED");
  }

  const code = otpGenerator();
  const challenge = await prisma.voiceOtpChallenge.create({
    data: {
      intentId: intent.id,
      userId,
      codeHash: sha256Hex(code),
      maxAttempts: MAX_OTP_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
    select: { id: true, expiresAt: true },
  });

  await prisma.voiceBookingIntent.update({
    where: { id: intent.id },
    data: { status: "OTP_SENT" },
  });

  await enqueueNotificationOutbox([
    {
      userId,
      channel: "APP",
      dedupeKey: `voice.otp:${challenge.id}:APP`,
      title: "Confirm your FlightOne booking",
      body: "Enter the one-time code sent to you to confirm this voice booking. FlightOne will not ticket or charge until this code is verified.",
      payload: { kind: "voice.otp", intentId: intent.id, sessionId: session.id },
    },
    {
      userId,
      channel: "EMAIL",
      dedupeKey: `voice.otp:${challenge.id}:EMAIL`,
      title: "Confirm your FlightOne booking",
      body: `Your FlightOne voice booking confirmation code is ${code}. It expires in 10 minutes. If you did not request this, ignore the message.`,
      payload: { kind: "voice.otp", intentId: intent.id },
    },
  ]);

  await audit(userId, "voice.otp.request", "VoiceOtpChallenge", challenge.id, {
    intentId: intent.id,
    sessionId: session.id,
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    otpRequired: true,
    booked: false,
    message: publicVoiceMessage("VOICE_OTP_REQUIRED"),
  };
}

export async function confirmVoiceBookingOtp(userId, sessionId, { intentId, code }) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  const intent = await prisma.voiceBookingIntent.findFirst({
    where: { id: intentId, sessionId: session.id, userId },
    select: INTENT_SELECT,
  });
  if (!intent) throw new AppError(404, "Voice booking confirmation not found");
  if (intent.status === "CONFIRMED" && intent.bookingId) {
    return {
      confirmed: true,
      booked: true,
      ticketed: false,
      bookingId: intent.bookingId,
      status: "QUOTED",
    };
  }

  const challenge = await prisma.voiceOtpChallenge.findFirst({
    where: { intentId: intent.id, userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw voiceError(400, "VOICE_OTP_REQUIRED");
  if (challenge.expiresAt < new Date()) {
    await prisma.voiceOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw voiceError(410, "VOICE_OTP_EXPIRED");
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw voiceError(429, "VOICE_OTP_INVALID");
  }

  const presented = String(code || "").replace(/\s+/g, "");
  const ok =
    presented.length === 6 &&
    crypto.timingSafeEqual(
      Buffer.from(sha256Hex(presented), "hex"),
      Buffer.from(challenge.codeHash, "hex"),
    );

  await prisma.voiceOtpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 }, consumedAt: ok ? new Date() : undefined },
  });

  if (!ok) {
    await audit(userId, "voice.otp.failed", "VoiceOtpChallenge", challenge.id, {
      intentId: intent.id,
    });
    throw voiceError(401, "VOICE_OTP_INVALID");
  }

  let booking;
  try {
    booking = await bookingsService.createQuote(
      userId,
      {
        product: intent.product,
        currency: intent.currency,
        amountMinor: intent.amountMinor,
        supplierOfferSnapshotId: intent.supplierOfferSnapshotId,
        netMinor: intent.amountMinor,
        idempotencyKey: `voice:${intent.id}`,
        metadata: {
          source: "voice",
          voiceSessionId: session.id,
          voiceIntentId: intent.id,
          ...(process.env.NODE_ENV === "test" ? { forceClientPrice: true } : {}),
        },
      },
      "CUSTOMER",
    );
  } catch (err) {
    await audit(userId, "voice.booking.failed", "VoiceBookingIntent", intent.id, {
      reason: "quote_failed",
    });
    if (err instanceof AppError) throw err;
    throw new AppError(409, "Unable to create a quote from this voice confirmation");
  }

  await prisma.voiceBookingIntent.update({
    where: { id: intent.id },
    data: { status: "CONFIRMED", bookingId: booking.id },
  });
  await prisma.voiceSession.update({
    where: { id: session.id },
    data: { state: "COMPLETED" },
  });

  await enqueueNotificationOutbox([
    {
      userId,
      channel: "APP",
      dedupeKey: `voice.booking.quoted:${intent.id}:APP`,
      title: "Voice booking quote ready",
      body: "Your voice confirmation created a quote. Payment and ticketing still use the existing checkout flow.",
      payload: { kind: "voice.booking.quoted", bookingId: booking.id },
    },
  ]);

  await audit(userId, "voice.otp.confirmed", "VoiceBookingIntent", intent.id, {
    bookingId: booking.id,
    status: booking.status,
    ticketed: false,
  });

  return {
    confirmed: true,
    booked: true,
    ticketed: false,
    paid: false,
    bookingId: booking.id,
    status: booking.status,
    message: "Quote created. Complete payment and ticketing in checkout — voice will not ticket or charge.",
  };
}

/**
 * Telephony inbound webhook. Never trusts caller-provided identity.
 * Unconfigured providers return an honest unavailable state — no fake calls.
 */
export async function handleTelephonyInbound(req) {
  if (!assertPhoneProviderConfigured()) {
    throw voiceError(503, "VOICE_TELEPHONY_UNCONFIGURED");
  }
  const expected = process.env.VOICE_TELEPHONY_API_KEY;
  const provided = req.headers["x-voice-api-key"] || req.headers["x-twilio-signature"];
  if (!expected || !provided || String(provided) !== expected) {
    throw voiceError(401, "VOICE_TELEPHONY_UNAVAILABLE");
  }

  const fromRaw = req.body?.From || req.body?.from || "";
  let userId = null;
  let phoneHash = null;
  try {
    phoneHash = hashPhone(fromRaw);
    const binding = await prisma.voiceCallerBinding.findFirst({
      where: { phoneHash },
      select: { userId: true },
    });
    userId = binding?.userId || null;
  } catch {
    userId = null;
  }

  if (!userId) {
    const session = await prisma.voiceSession.create({
      data: {
        userId: null,
        channel: "PHONE",
        state: "UNAVAILABLE",
        lastErrorCode: "VOICE_UNAUTHENTICATED",
        callerPhoneHash: phoneHash,
      },
      select: SESSION_SELECT,
    });
    await audit(null, "voice.telephony.unauthenticated", "VoiceSession", session.id, {
      associated: false,
    });
    return {
      session: publicSession(session),
      associated: false,
      reply: publicVoiceMessage("VOICE_UNAUTHENTICATED"),
    };
  }

  const session = await prisma.voiceSession.create({
    data: {
      userId,
      channel: "PHONE",
      state: "IDLE",
      callerPhoneHash: phoneHash,
    },
    select: SESSION_SELECT,
  });
  await audit(userId, "voice.telephony.inbound", "VoiceSession", session.id, {
    associated: true,
  });
  return {
    session: publicSession(session),
    associated: true,
    reply: "You're through to Ava. How can I help with your trip?",
  };
}

export async function markSessionState(userId, sessionId, state, lastErrorCode = null) {
  const session = await ownedSessionOrThrow(userId, sessionId);
  const allowed = new Set([
    "IDLE",
    "LISTENING",
    "PROCESSING",
    "SPEAKING",
    "CONFIRMATION_REQUIRED",
    "COMPLETED",
    "FAILED",
    "UNAVAILABLE",
  ]);
  if (!allowed.has(state)) throw new AppError(400, "Invalid voice state");
  const updated = await prisma.voiceSession.update({
    where: { id: session.id },
    data: { state, lastErrorCode },
    select: SESSION_SELECT,
  });
  return publicSession(updated);
}
