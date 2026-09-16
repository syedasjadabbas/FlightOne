/**
 * Module 13 — deterministic escalation intent + context helpers.
 * No fabricated VIP, supplier failure, or medical advice.
 */
import prisma from "../../config/prisma.js";
import { normalizeEscalationTrigger } from "./escalations.validators.js";

const CUSTOMER_REQUEST_RE =
  /\b(talk\s+to\s+(an?\s+)?(human|agent|person|consultant|advisor)|speak\s+(to|with)\s+(an?\s+)?(human|agent|person|consultant)|connect\s+me\s+(with|to)\s+(an?\s+)?(human|agent|consultant)|need\s+(an?\s+)?(travel\s+)?(human|live\s+)?(agent|consultant|person)|real\s+(person|human|agent)|live\s+(agent|chat|support|consultant)|human\s+(agent|consultant|support)|transfer\s+(me\s+)?to\s+(an?\s+)?agent)\b/i;

const MEDICAL_RE =
  /\b(medical\s+(assistance|emergency|help|issue|condition)|need\s+medical|wheelchair|stretcher|oxygen|hospital|ambulance|doctor\s+on\s+board|health\s+emergency|fit\s+to\s+fly)\b/i;

const SSR_RE =
  /\b(special\s+service(\s+request)?|ssr\b|special\s+assistance|unaccompanied\s+minor|um\b|pet\s+in\s+cabin|service\s+animal|kosher\s+meal|halal\s+meal|extra\s+seat|bassinet|mobility\s+aid)\b/i;

const REFUND_DISPUTE_RE =
  /\b(refund\s+dispute|dispute\s+(my\s+)?refund|refund\s+(was\s+)?(wrong|incorrect|denied|rejected)|disagree\s+with\s+(the\s+)?refund|contest\s+(the\s+)?refund|refund\s+not\s+(received|processed))\b/i;

/**
 * Detect customer-message escalation intent. Returns a PRD trigger or null.
 * Prefer more specific triggers before generic CUSTOMER_REQUEST.
 */
export function detectEscalationIntentFromMessage(message) {
  const text = String(message || "").trim();
  if (!text) return null;
  if (REFUND_DISPUTE_RE.test(text)) return "REFUND_DISPUTE";
  if (SSR_RE.test(text)) return "SPECIAL_SERVICE_REQUEST";
  if (MEDICAL_RE.test(text)) return "MEDICAL_ASSISTANCE";
  if (CUSTOMER_REQUEST_RE.test(text)) return "CUSTOMER_REQUEST";
  return null;
}

/**
 * VIP signal — only when configured.
 * Default: no authoritative VIP field exists on Booking/User.
 * Optional env ESCALATION_VIP_REWARD_TIERS=PLATINUM maps reward tier → VIP_BOOKING.
 * This is explicit configuration, not an invented VIP status.
 */
export function getConfiguredVipRewardTiers() {
  const raw = process.env.ESCALATION_VIP_REWARD_TIERS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function evaluateVipBookingEscalation({ userId, bookingId } = {}) {
  const tiers = getConfiguredVipRewardTiers();
  if (!tiers.length) {
    return {
      shouldEscalate: false,
      reason:
        "No authoritative VIP indicator configured (set ESCALATION_VIP_REWARD_TIERS or a future VIP flag).",
      trigger: "VIP_BOOKING",
    };
  }
  if (!userId) {
    return { shouldEscalate: false, reason: "userId required", trigger: "VIP_BOOKING" };
  }

  const account = await prisma.rewardAccount.findUnique({
    where: { userId },
    select: { tier: true },
  });
  const tier = account?.tier ? String(account.tier).toUpperCase() : null;
  if (!tier || !tiers.includes(tier)) {
    return {
      shouldEscalate: false,
      reason: `Reward tier ${tier || "none"} is not in configured VIP tiers (${tiers.join(",")})`,
      trigger: "VIP_BOOKING",
      tier,
    };
  }

  let booking = null;
  if (bookingId) {
    booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true, status: true, product: true, metadata: true },
    });
  }

  return {
    shouldEscalate: true,
    reason: `Configured VIP reward tier ${tier}`,
    trigger: "VIP_BOOKING",
    tier,
    bookingId: booking?.id ?? bookingId ?? null,
    booking,
  };
}

/**
 * Complex itinerary — deterministic rules on real booking attributes only.
 * Escalates when metadata indicates multi-city / 3+ flight segments / PACKAGE
 * with multi-leg snapshot — never an arbitrary invented score.
 */
export function evaluateComplexItineraryFromBooking(booking) {
  if (!booking) {
    return { shouldEscalate: false, reason: "No booking", trigger: "COMPLEX_ITINERARY" };
  }
  const meta =
    booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
  const reasons = [];

  const tripType = String(meta.tripType || meta.trip_type || "").toUpperCase();
  if (["MULTI_CITY", "MULTICITY", "OPEN_JAW", "CIRCLE"].includes(tripType)) {
    reasons.push(`tripType=${tripType}`);
  }

  const segments =
    meta.segments ||
    meta.legs ||
    meta.flightSegments ||
    meta.itinerary?.segments ||
    meta.itinerary?.legs ||
    null;
  const segmentCount = Array.isArray(segments) ? segments.length : 0;
  if (segmentCount >= 3) {
    reasons.push(`segmentCount=${segmentCount}`);
  }

  const ticketCount = Number(meta.ticketCount || meta.tickets || 0);
  if (Number.isFinite(ticketCount) && ticketCount >= 2) {
    reasons.push(`ticketCount=${ticketCount}`);
  }

  if (booking.product === "PACKAGE" && segmentCount >= 2) {
    reasons.push("PACKAGE with multi-leg itinerary");
  }

  if (!reasons.length) {
    return {
      shouldEscalate: false,
      reason: "Itinerary does not meet multi-leg / multi-ticket complexity rules",
      trigger: "COMPLEX_ITINERARY",
      segmentCount,
      tripType: tripType || null,
    };
  }

  return {
    shouldEscalate: true,
    reason: reasons.join("; "),
    trigger: "COMPLEX_ITINERARY",
    segmentCount,
    tripType: tripType || null,
  };
}

export async function evaluateComplexItineraryEscalation({ userId, bookingId } = {}) {
  if (!bookingId || !userId) {
    return {
      shouldEscalate: false,
      reason: "bookingId and userId required",
      trigger: "COMPLEX_ITINERARY",
    };
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, product: true, metadata: true, status: true },
  });
  if (!booking) {
    return { shouldEscalate: false, reason: "Booking not found for user", trigger: "COMPLEX_ITINERARY" };
  }
  return { ...evaluateComplexItineraryFromBooking(booking), bookingId: booking.id, booking };
}

/**
 * Supplier failure — only when caller supplies an authoritative failure signal.
 * Ordinary empty inventory is NOT a failure unless classified as requiring
 * human intervention by the existing system (`requiresHumanIntervention: true`
 * or `failureClass: "HARD"` / `"ESCALATE"`).
 */
export function evaluateSupplierFailureEscalation({
  requiresHumanIntervention,
  failureClass,
  supplierCode,
  errorCode,
  message,
} = {}) {
  const cls = String(failureClass || "").toUpperCase();
  const hard =
    requiresHumanIntervention === true ||
    cls === "HARD" ||
    cls === "ESCALATE" ||
    cls === "HUMAN_REQUIRED";

  if (!hard) {
    return {
      shouldEscalate: false,
      reason:
        "No authoritative supplier-failure signal (requiresHumanIntervention / HARD / ESCALATE)",
      trigger: "SUPPLIER_FAILURE",
    };
  }

  return {
    shouldEscalate: true,
    reason: message || `Supplier failure class ${cls || "HUMAN_REQUIRED"}`,
    trigger: "SUPPLIER_FAILURE",
    supplierCode: supplierCode || null,
    errorCode: errorCode || null,
    failureClass: cls || null,
  };
}

export function normalizeTriggerOrThrow(trigger) {
  const normalized = normalizeEscalationTrigger(trigger);
  return normalized;
}
