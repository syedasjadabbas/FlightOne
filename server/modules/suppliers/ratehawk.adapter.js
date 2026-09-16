/**
 * RateHawk / Emerging Travel B2B adapter boundary.
 * Never invents hotel inventory or confirmations.
 *
 * Live HTTP only when RATEHAWK_KEY_ID + RATEHAWK_API_KEY are set.
 * Booking finish uses deposit/agency payment_type from the form response —
 * never PAN/CVV. Missing guests/contact/IP/payment options → DATA_UNAVAILABLE.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { DEFAULT_SUPPLIER_TIMEOUT_MS, withCircuitBreaker, withTimeout } from "./adapter.js";

export const SUPPLIER_CODE = "RATEHAWK";
export const RATEHAWK_CIRCUIT_PREBOOK = "RATEHAWK_PREBOOK";
export const RATEHAWK_CIRCUIT_BOOK = "RATEHAWK_BOOK";

/** @type {null | ((path: string, body: object) => Promise<{ res: { ok: boolean, status: number }, json: any }>)} */
let rateHawkFetchOverride = null;

export function setRateHawkFetchForTests(fn) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot override RateHawk fetch in production");
  }
  rateHawkFetchOverride = typeof fn === "function" ? fn : null;
}

export function isRateHawkConfigured() {
  return Boolean(process.env.RATEHAWK_KEY_ID && process.env.RATEHAWK_API_KEY);
}

export function getRateHawkCapability() {
  if (isRateHawkConfigured()) {
    return {
      configured: true,
      mode: "live",
      canSearch: true,
      canReserve: true,
      canTicket: true,
      reasons: [],
    };
  }
  return {
    configured: false,
    mode: "unconfigured",
    canSearch: false,
    canReserve: false,
    canTicket: false,
    reasons: ["RateHawk credentials are not configured (RATEHAWK_KEY_ID / RATEHAWK_API_KEY)"],
  };
}

function rateHawkAuthHeader() {
  const raw = `${process.env.RATEHAWK_KEY_ID}:${process.env.RATEHAWK_API_KEY}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

function rateHawkBaseUrl() {
  return (process.env.RATEHAWK_API_BASE || "https://api.worldota.net").replace(/\/$/, "");
}

async function rateHawkFetch(path, body) {
  if (rateHawkFetchOverride) return rateHawkFetchOverride(path, body);
  const url = `${rateHawkBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: rateHawkAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(Number(process.env.RATEHAWK_TIMEOUT_MS) || 30000),
    });
  } catch (e) {
    throw new AppError(502, `RateHawk ${path} failed: ${e?.message || "network error"}`);
  }
  const json = await res.json().catch(() => null);
  return { res, json };
}

function fakeOffer(query, index) {
  const amountMinor = 9000 + index * 4000;
  return {
    supplierCode: SUPPLIER_CODE,
    offerId: `RH-${query.cityCode}-${index + 1}`,
    product: "HOTEL",
    currency: "USD",
    amountMinor,
    fareRules: {
      refundable: index === 0,
      cancellationDeadline: query.checkInDate,
    },
    details: {
      cityCode: query.cityCode,
      city: query.cityCode,
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      rooms: query.rooms ?? 1,
      guests: query.guests ?? 1,
      hotelName: index === 0 ? "FlightOne Partner Hotel" : "FlightOne Select Hotel",
      starRating: index === 0 ? 4 : 3,
      area: "City centre",
      roomType: "Standard Room",
      breakfastIncluded: index === 0,
    },
  };
}

function normalizeLiveHotel(row, query) {
  const amount =
    row?.price ||
    row?.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount ||
    row?.rates?.[0]?.daily_prices?.[0];
  const major = typeof amount === "number" ? amount : Number(amount);
  const amountMinor = Number.isFinite(major) && major > 0 ? Math.round(major * 100) : null;
  const offerId = row?.hid ? `RH-${row.hid}` : row?.id ? `RH-${row.id}` : null;
  const bookHash = row?.rates?.[0]?.book_hash || row?.book_hash || null;
  if (!offerId || !amountMinor) return null;
  return {
    supplierCode: SUPPLIER_CODE,
    offerId,
    product: "HOTEL",
    currency: String(row?.rates?.[0]?.payment_options?.payment_types?.[0]?.show_currency_code || "USD"),
    amountMinor,
    fareRules: { refundable: Boolean(row?.rates?.[0]?.payment_options?.payment_types?.[0]) },
    details: {
      cityCode: query.cityCode,
      regionId: query.regionId ?? null,
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      hotelName: row?.name || row?.hotel_name || null,
      bookHash,
      hid: row?.hid ?? null,
    },
  };
}

async function performLiveSearch(query) {
  const regionRaw =
    query.regionId != null && query.regionId !== "" ? query.regionId : query.cityCode;
  const regionId = Number(regionRaw);
  if (!Number.isFinite(regionId) || regionId <= 0) {
    console.warn(
      `[${SUPPLIER_CODE}] Live search skipped — numeric regionId required (got cityCode=${query.cityCode}, regionId=${query.regionId})`,
    );
    return [];
  }
  const { res, json } = await rateHawkFetch("/api/b2b/v3/search/serp/hotels/", {
    checkin: query.checkInDate,
    checkout: query.checkOutDate,
    residency: "pk",
    language: "en",
    guests: [{ adults: query.guests ?? 1, children: [] }],
    region_id: regionId,
  });
  if (!res.ok || json?.status !== "ok" || !Array.isArray(json?.data?.hotels)) {
    return [];
  }
  return json.data.hotels.map((row) => normalizeLiveHotel(row, query)).filter(Boolean);
}

async function performStubSearch(query) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [fakeOffer(query, 0), fakeOffer(query, 1)];
}

/** @param {import('./adapter.js').HotelSearchQuery} query */
export async function searchHotels(query, { timeoutMs } = {}) {
  const ms = timeoutMs ?? DEFAULT_SUPPLIER_TIMEOUT_MS;
  if (isRateHawkConfigured()) {
    return withTimeout(
      performLiveSearch(query),
      Number(process.env.RATEHAWK_TIMEOUT_MS) || 30000,
      `${SUPPLIER_CODE} searchHotels`,
    );
  }
  if (process.env.NODE_ENV === "production") {
    console.error(`[${SUPPLIER_CODE}] Hotel search not configured — refusing stub hotel inventory in production`);
    return [];
  }
  console.warn(`[${SUPPLIER_CODE}] Hotel search not configured — using local stub offers (dev only)`);
  return withTimeout(performStubSearch(query), ms, `${SUPPLIER_CODE} searchHotels`);
}

function bookingRefsOf(booking) {
  const refs = booking?.supplierBookingRefs;
  if (refs?.booking && typeof refs.booking === "object") return refs.booking;
  return refs && typeof refs === "object" ? refs : {};
}

function itineraryOf(booking) {
  const refs = booking?.supplierBookingRefs;
  return refs?.itinerary && typeof refs.itinerary === "object" ? refs.itinerary : {};
}

function fareOf(booking) {
  const refs = booking?.supplierBookingRefs;
  return refs?.fare && typeof refs.fare === "object" ? refs.fare : {};
}

export function extractRateHawkBookHash(booking) {
  const bookingRefs = bookingRefsOf(booking);
  const itinerary = itineraryOf(booking);
  const fare = fareOf(booking);
  return (
    bookingRefs.bookHash ||
    itinerary.bookHash ||
    fare.bookHash ||
    booking?.metadata?.ratehawk?.bookHash ||
    null
  );
}

/**
 * Build guests for finish from travellerSnapshot / metadata. Never invents names.
 * @returns {{ guests: Array<{ first_name: string, last_name: string }> } | { error: string }}
 */
export function buildRateHawkGuests(booking) {
  const snap = booking?.travellerSnapshot && typeof booking.travellerSnapshot === "object"
    ? booking.travellerSnapshot
    : {};
  const meta = booking?.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
  const guestsRaw = Array.isArray(snap.guests)
    ? snap.guests
    : Array.isArray(meta.guests)
      ? meta.guests
      : null;

  const guests = [];
  if (guestsRaw) {
    for (const g of guestsRaw) {
      const first =
        g?.first_name || g?.firstName || g?.givenName || g?.given_name || null;
      const last = g?.last_name || g?.lastName || g?.surname || g?.familyName || null;
      if (first && last) guests.push({ first_name: String(first).trim(), last_name: String(last).trim() });
    }
  } else {
    const first =
      snap.givenName || snap.firstName || snap.first_name || meta.givenName || null;
    const last = snap.surname || snap.lastName || snap.last_name || meta.surname || null;
    if (first && last) guests.push({ first_name: String(first).trim(), last_name: String(last).trim() });
  }

  if (!guests.length) {
    return { error: "DATA_UNAVAILABLE: guest first_name/last_name required for RateHawk finish" };
  }
  return { guests };
}

/**
 * Prefer agency deposit payment types from the booking form. Never send card data.
 * @returns {{ payment_type: object } | { error: string }}
 */
export function selectRateHawkPaymentType(formData, booking) {
  const types =
    formData?.payment_types ||
    formData?.payment_options?.payment_types ||
    formData?.order?.payment_types ||
    [];
  if (!Array.isArray(types) || !types.length) {
    return { error: "DATA_UNAVAILABLE: RateHawk form returned no payment_types" };
  }

  const deposit = types.find((t) => String(t?.type || "").toLowerCase() === "deposit");
  const hotel = types.find((t) => String(t?.type || "").toLowerCase() === "hotel");
  const chosen = deposit || hotel || null;

  if (!chosen) {
    const now = types.find((t) => String(t?.type || "").toLowerCase() === "now");
    if (now?.is_need_credit_card_data || now?.is_need_cvc) {
      return {
        error:
          "DATA_UNAVAILABLE: RateHawk requires card data on payment_type=now — FlightOne never stores/sends PAN/CVV; use deposit contract",
      };
    }
    return { error: "DATA_UNAVAILABLE: no deposit/hotel payment_type available from RateHawk form" };
  }

  const amount =
    chosen.amount != null
      ? String(chosen.amount)
      : chosen.show_amount != null
        ? String(chosen.show_amount)
        : booking?.netMinor != null
          ? (Number(booking.netMinor) / 100).toFixed(2)
          : null;
  const currency =
    chosen.currency_code || chosen.show_currency_code || booking?.currency || null;
  if (!amount || !currency) {
    return { error: "DATA_UNAVAILABLE: RateHawk payment_type missing amount/currency" };
  }

  return {
    payment_type: {
      type: String(chosen.type).toLowerCase(),
      amount,
      currency_code: String(currency).toUpperCase(),
    },
  };
}

export function resolveRateHawkUserIp(booking) {
  const meta = booking?.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
  const ip = meta.requestIp || meta.clientIp || meta.userIp || booking?.requestIp || null;
  if (!ip || typeof ip !== "string" || !ip.trim()) return null;
  const trimmed = ip.trim();
  // Never invent loopback as a client IP in production.
  if (trimmed === "127.0.0.1" && process.env.NODE_ENV === "production") return null;
  return trimmed;
}

async function resolveContact(booking) {
  const snap = booking?.travellerSnapshot && typeof booking.travellerSnapshot === "object"
    ? booking.travellerSnapshot
    : {};
  const meta = booking?.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
  let email = snap.email || meta.email || meta.contactEmail || null;
  let phone = snap.phone || meta.phone || meta.contactPhone || null;

  if ((!email || !phone) && booking?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: booking.userId },
      select: { email: true },
    });
    if (!email && user?.email) email = user.email;
  }

  if (!email || !phone) {
    return {
      error: "DATA_UNAVAILABLE: contact email and phone required for RateHawk finish",
    };
  }
  return { email: String(email).trim(), phone: String(phone).trim() };
}

function extractPrebookPriceMinor(data) {
  const rate = data?.hotels?.[0]?.rates?.[0] || data?.rates?.[0] || data?.rate || null;
  const payment = rate?.payment_options?.payment_types?.[0];
  const amount = payment?.show_amount ?? payment?.amount ?? rate?.daily_prices?.[0];
  const major = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

function extractPrebookCurrency(data, fallback) {
  const rate = data?.hotels?.[0]?.rates?.[0] || data?.rates?.[0] || data?.rate || null;
  const payment = rate?.payment_options?.payment_types?.[0];
  return (
    payment?.show_currency_code ||
    payment?.currency_code ||
    data?.currency ||
    fallback ||
    null
  );
}

/**
 * Live RateHawk prebook (rate actualization) — authoritative reprice before reserve.
 * @returns {Promise<{ status: "ok"|"unavailable"|"unconfigured"|"expired", netMinor?: number, currency?: string, details?: object }>}
 */
export async function prebookRateHawk(booking) {
  if (!isRateHawkConfigured()) {
    return { status: "unconfigured", details: { reason: "RateHawk credentials are not configured" } };
  }
  const hash = extractRateHawkBookHash(booking);
  if (!hash) {
    return { status: "unavailable", details: { reason: "Missing RateHawk book_hash for prebook" } };
  }

  const priceIncreasePercent = Number(process.env.RATEHAWK_PREBOOK_PRICE_INCREASE_PERCENT);
  const body = {
    hash,
    ...(Number.isFinite(priceIncreasePercent) && priceIncreasePercent >= 0
      ? { price_increase_percent: Math.floor(priceIncreasePercent) }
      : {}),
  };

  return withCircuitBreaker(
    RATEHAWK_CIRCUIT_PREBOOK,
    async () => {
      try {
        const { res, json } = await rateHawkFetch("/api/b2b/v3/hotel/prebook/", body);
        if (!res.ok || json?.status !== "ok") {
          const err = String(json?.error || "");
          if (err.includes("rate_not_found") || err.includes("not_found")) {
            return { status: "expired", details: { reason: err || "RateHawk rate_not_found" } };
          }
          return {
            status: "unavailable",
            details: { reason: json?.error || json?.debug || `RateHawk prebook HTTP ${res.status}` },
          };
        }

        const data = json?.data || {};
        const newHash =
          data.book_hash ||
          data?.hotels?.[0]?.rates?.[0]?.book_hash ||
          data?.rates?.[0]?.book_hash ||
          hash;
        const netMinor = extractPrebookPriceMinor(data);
        const currency = extractPrebookCurrency(data, booking.currency);
        if (netMinor == null || !currency) {
          return {
            status: "unavailable",
            details: { reason: "RateHawk prebook returned no authoritative price" },
          };
        }

        const priceChanged = Boolean(data?.changes?.price_changed) || netMinor !== booking.netMinor;

        return {
          status: "ok",
          netMinor,
          currency: String(currency).toUpperCase(),
          details: {
            supplierBookingRefs: {
              ...bookingRefsOf(booking),
              bookHash: newHash,
            },
            priceChanged,
            previousBookHash: hash,
            bookHash: newHash,
            source: "ratehawk_prebook",
          },
        };
      } catch (err) {
        return {
          status: "unavailable",
          details: { reason: err?.message || "RateHawk prebook failed" },
        };
      }
    },
    {
      isFailure: (v) => v?.status === "unavailable",
      onOpen: "return",
      openResult: () => ({
        status: "unavailable",
        details: { reason: "RATEHAWK_PREBOOK circuit open", code: "SUPPLIER_CIRCUIT_OPEN" },
      }),
    },
  );
}

async function pollFinishStatus(partnerOrderId, { maxAttempts = 15 } = {}) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const { res, json } = await rateHawkFetch("/api/b2b/v3/hotel/order/booking/finish/status/", {
      partner_order_id: partnerOrderId,
    });
    const status = json?.status || json?.data?.status;
    if (res.ok && status === "ok") {
      return { status: "ok", json };
    }
    if (status === "error" || status === "failed") {
      return { status: "failed", json };
    }
    if (status === "3ds") {
      return {
        status: "failed",
        json,
        reason: "DATA_UNAVAILABLE: RateHawk 3DS required — card payment path not supported",
      };
    }
    // processing — brief wait (tests override fetch so this is fast)
    await new Promise((r) => setTimeout(r, Number(process.env.RATEHAWK_FINISH_POLL_MS) || 200));
  }
  return { status: "failed", reason: "RateHawk finish status polling timed out" };
}

/**
 * @returns {Promise<{ status: "ok"|"failed"|"unconfigured"|"DATA_UNAVAILABLE", externalRef?: string|null, voucherRefs?: string[], details?: object }>}
 */
export async function bookRateHawkReservation(booking) {
  if (!isRateHawkConfigured()) {
    return { status: "unconfigured", details: { reason: "RateHawk credentials are not configured" } };
  }

  return withCircuitBreaker(
    RATEHAWK_CIRCUIT_BOOK,
    async () => bookRateHawkReservationInner(booking),
    {
      isFailure: (v) => v?.status === "failed" || v?.status === "DATA_UNAVAILABLE",
      onOpen: "return",
      openResult: () => ({
        status: "failed",
        details: { reason: "RATEHAWK_BOOK circuit open", code: "SUPPLIER_CIRCUIT_OPEN" },
      }),
    },
  );
}

async function bookRateHawkReservationInner(booking) {
  const bookHash = extractRateHawkBookHash(booking);
  if (!bookHash) {
    return { status: "failed", details: { reason: "Missing RateHawk book_hash for reservation" } };
  }

  const guestBuilt = buildRateHawkGuests(booking);
  if (guestBuilt.error) {
    return { status: "DATA_UNAVAILABLE", details: { reason: guestBuilt.error } };
  }

  const contact = await resolveContact(booking);
  if (contact.error) {
    return { status: "DATA_UNAVAILABLE", details: { reason: contact.error } };
  }

  const userIp = resolveRateHawkUserIp(booking);
  if (!userIp) {
    return {
      status: "DATA_UNAVAILABLE",
      details: { reason: "DATA_UNAVAILABLE: client requestIp required for RateHawk booking form" },
    };
  }

  const partnerOrderId = `fo-${booking.id}`;

  try {
    const form = await rateHawkFetch("/api/b2b/v3/hotel/order/booking/form/", {
      partner_order_id: partnerOrderId,
      book_hash: bookHash,
      language: "en",
      user_ip: userIp,
    });
    if (!form.res.ok || form.json?.status !== "ok") {
      return {
        status: "failed",
        details: { reason: form.json?.error || form.json?.debug || "RateHawk booking form rejected" },
      };
    }

    const pay = selectRateHawkPaymentType(form.json?.data || {}, booking);
    if (pay.error) {
      return { status: "DATA_UNAVAILABLE", details: { reason: pay.error } };
    }

    const finishBody = {
      partner: { partner_order_id: partnerOrderId },
      partner_order_id: partnerOrderId,
      language: "en",
      user: {
        email: contact.email,
        phone: contact.phone,
      },
      rooms: [{ guests: guestBuilt.guests }],
      payment_type: pay.payment_type,
    };

    const finish = await rateHawkFetch("/api/b2b/v3/hotel/order/booking/finish/", finishBody);
    if (!finish.res.ok || (finish.json?.status !== "ok" && finish.json?.status !== "processing")) {
      // Some ETG responses return processing without ok — still poll status.
      if (finish.json?.status !== "processing") {
        return {
          status: "failed",
          details: { reason: finish.json?.error || "RateHawk finish rejected" },
        };
      }
    }

    const polled = await pollFinishStatus(partnerOrderId);
    if (polled.status !== "ok") {
      return {
        status: "failed",
        details: {
          reason: polled.reason || polled.json?.error || "RateHawk booking did not confirm",
        },
      };
    }

    const orderId =
      polled.json?.data?.order_id ||
      polled.json?.data?.partner_order_id ||
      finish.json?.data?.order_id ||
      partnerOrderId;

    return {
      status: "ok",
      externalRef: String(orderId),
      voucherRefs: [String(orderId)],
      details: {
        source: "ratehawk",
        partnerOrderId,
        paymentType: pay.payment_type.type,
        // Never echo card tokens — none were sent.
      },
    };
  } catch (err) {
    return { status: "failed", details: { reason: err?.message || "RateHawk book failed" } };
  }
}

export async function confirmRateHawkVoucher(booking) {
  const existingVouchers = booking?.metadata?.supplierBooking?.ticket?.voucherRefs;
  if (Array.isArray(existingVouchers) && existingVouchers.length > 0) {
    return {
      status: "ok",
      externalRef: booking.externalRef ?? null,
      voucherRefs: existingVouchers,
      details: { idempotent: true },
    };
  }
  if (booking?.externalRef) {
    return {
      status: "ok",
      externalRef: booking.externalRef,
      voucherRefs: [String(booking.externalRef)],
      details: { idempotent: true, source: "reserve_externalRef" },
    };
  }
  return {
    status: "failed",
    details: {
      reason:
        "RateHawk voucher confirmation missing — refusing re-book on ticket (reserve must confirm order first)",
    },
  };
}

export async function cancelRateHawkHold(booking) {
  if (!isRateHawkConfigured()) {
    return { status: "skipped", reason: "RateHawk unconfigured" };
  }
  const orderId = booking?.externalRef;
  if (!orderId) return { status: "skipped", reason: "no RateHawk order id" };
  try {
    const { res, json } = await rateHawkFetch("/api/b2b/v3/hotel/order/cancel/", {
      partner_order_id: `fo-${booking.id}`,
      order_id: orderId,
    });
    if (res.ok && json?.status === "ok") {
      return { status: "ok", orderId };
    }
    return { status: "failed", reason: json?.error || `RateHawk cancel HTTP ${res.status}` };
  } catch (err) {
    return { status: "failed", reason: err?.message || "RateHawk cancel failed" };
  }
}
