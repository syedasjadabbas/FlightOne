/**
 * Module 09 — Live Journey Management.
 *
 * Monitors confirmed (TICKETED/ACTIVE) bookings only. Live status comes from
 * journey.statusProvider — never fabricated. Notifications use NotificationOutbox
 * with stable dedupe keys. Rebooking is a handoff to Module 03 quote flow —
 * never auto-charges, auto-books, or silently substitutes flights.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import logger from "../../lib/logger.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import {
  fetchFlightStatus,
  getJourneyStatusCapability,
} from "./journey.statusProvider.js";
import {
  boardingReminderDedupeKey,
  detectMeaningfulStatusChanges,
  journeyChangeDedupeKey,
  maybeBoardingReminder,
} from "./journey.changes.js";
import {
  fetchWeatherDisruption,
  fetchHotelCheckInStatus,
  fetchTransferStatus,
  fetchImmigrationAdvisory,
  getAncillaryCapabilities,
} from "./journey.ancillaryProviders.js";
import {
  ancillaryDedupeKey,
  detectWeatherChanges,
  detectHotelStatusChanges,
  detectTransferStatusChanges,
  detectImmigrationChanges,
  maybeHotelCheckinReminder,
  maybeTransferReminder,
} from "./journey.ancillaryChanges.js";

const MAX_PAGE_SIZE = 100;

const WATCHABLE_BOOKING_STATUSES = new Set(["TICKETED", "ACTIVE"]);

function notificationChannelsFromEnv(env = process.env) {
  const raw = env.JOURNEY_NOTIFICATION_CHANNELS?.trim();
  const allowed = new Set(["APP", "EMAIL", "WHATSAPP", "SMS"]);
  if (!raw) return ["APP", "EMAIL", "WHATSAPP"];
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => allowed.has(c));
  return parsed.length ? [...new Set(parsed)] : ["APP", "EMAIL", "WHATSAPP"];
}

const WATCH_SELECT = {
  id: true,
  bookingId: true,
  userId: true,
  status: true,
  flightNumber: true,
  departAt: true,
  arriveAt: true,
  lastPolledAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

const EVENT_SELECT = {
  id: true,
  watchId: true,
  type: true,
  severity: true,
  title: true,
  body: true,
  fingerprint: true,
  payload: true,
  notifiedAt: true,
  createdAt: true,
};

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  channel: true,
  dedupeKey: true,
  title: true,
  body: true,
  payload: true,
  status: true,
  createdAt: true,
  sentAt: true,
};

function asMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Extract journey monitoring fields from booking metadata (never invent). */
export function extractJourneyFieldsFromBooking(booking) {
  const meta = asMeta(booking?.metadata);
  const pricingInput = asMeta(meta.pricing?.input);
  const itinerary = asMeta(meta.itinerary);
  const hotel = asMeta(meta.hotel);
  const transfer = asMeta(meta.transfer);
  const flightNumber =
    meta.flightNumber ||
    itinerary.flightNumber ||
    meta.carrierFlightNumber ||
    null;
  const checkInDate =
    meta.checkInDate ||
    hotel.checkInDate ||
    pricingInput.checkInDate ||
    itinerary.checkInDate ||
    null;
  const checkOutDate =
    meta.checkOutDate ||
    hotel.checkOutDate ||
    pricingInput.checkOutDate ||
    itinerary.checkOutDate ||
    null;
  const departAt =
    meta.departAt ||
    meta.departureDate ||
    pricingInput.departureDate ||
    itinerary.departureDate ||
    checkInDate ||
    null;
  const arriveAt =
    meta.arriveAt || itinerary.arriveAt || checkOutDate || null;
  const origin =
    meta.origin || pricingInput.origin || itinerary.origin || null;
  const destination =
    meta.destination ||
    pricingInput.destination ||
    itinerary.destination ||
    hotel.cityCode ||
    pricingInput.cityCode ||
    null;
  const destinationCountry =
    meta.destinationCountry ||
    hotel.countryCode ||
    meta.countryCode ||
    (typeof destination === "string" && destination.length === 2 ? destination : null);
  const confirmationRef =
    meta.confirmationRef ||
    hotel.confirmationRef ||
    booking?.externalRef ||
    null;
  const transferRef = transfer.ref || meta.transferRef || null;
  const transferPickupAt =
    transfer.pickupAt || meta.transferPickupAt || null;

  return {
    flightNumber: flightNumber ? String(flightNumber).trim() : null,
    departAt: departAt ? new Date(departAt) : null,
    arriveAt: arriveAt ? new Date(arriveAt) : null,
    origin: origin ? String(origin).trim().toUpperCase() : null,
    destination: destination ? String(destination).trim().toUpperCase() : null,
    destinationCountry: destinationCountry
      ? String(destinationCountry).trim().toUpperCase().slice(0, 2)
      : null,
    product: booking?.product || null,
    checkInDate: checkInDate ? new Date(checkInDate).toISOString() : null,
    checkOutDate: checkOutDate ? new Date(checkOutDate).toISOString() : null,
    confirmationRef: confirmationRef ? String(confirmationRef) : null,
    transferRef: transferRef ? String(transferRef) : null,
    transferPickupAt: transferPickupAt
      ? new Date(transferPickupAt).toISOString()
      : null,
    nationality: meta.nationality || meta.visaCheck?.nationalityCode || null,
  };
}

async function getWatchOrThrow(id, select = WATCH_SELECT) {
  const watch = await prisma.journeyWatch.findUnique({ where: { id }, select });
  if (!watch) throw new AppError(404, "Journey watch not found");
  return watch;
}

export async function getOwnedWatchOrThrow(userId, id, select = WATCH_SELECT, permissions) {
  const watch = await getWatchOrThrow(id, { ...select, userId: true });
  const isOwner = watch.userId === userId;
  const hasReadPerm = hasPermissionEff(permissions, "journey:read");
  if (!isOwner && !hasReadPerm) throw new AppError(403, "Forbidden");
  return watch;
}

export function getJourneyCapability(env = process.env) {
  return {
    flightStatus: getJourneyStatusCapability(env),
    ...getAncillaryCapabilities(env),
    // Backward-compatible top-level fields (flight status).
    ...getJourneyStatusCapability(env),
    notificationChannels: notificationChannelsFromEnv(env),
  };
}

/**
 * Create/refresh ACTIVE watch for an eligible confirmed booking. Idempotent per bookingId.
 */
export async function ensureWatchForBooking({
  bookingId,
  userId,
  flightNumber,
  departAt,
  arriveAt,
} = {}) {
  if (!bookingId) throw new AppError(400, "bookingId is required");
  if (!userId) throw new AppError(400, "userId is required");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      product: true,
      metadata: true,
      externalRef: true,
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.userId !== userId) throw new AppError(403, "Forbidden");
  if (!WATCHABLE_BOOKING_STATUSES.has(booking.status)) {
    throw new AppError(
      409,
      `Booking is not eligible for journey monitoring (status ${booking.status})`,
    );
  }

  const extracted = extractJourneyFieldsFromBooking(booking);
  const resolvedFlight = flightNumber ?? extracted.flightNumber;
  let resolvedDepart = departAt !== undefined ? departAt : extracted.departAt;
  let resolvedArrive = arriveAt !== undefined ? arriveAt : extracted.arriveAt;
  if (resolvedDepart) resolvedDepart = new Date(resolvedDepart);
  if (resolvedArrive) resolvedArrive = new Date(resolvedArrive);
  if (resolvedDepart && Number.isNaN(resolvedDepart.getTime())) {
    throw new AppError(400, "departAt is invalid");
  }
  if (resolvedDepart && resolvedDepart.getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    const existingLate = await prisma.journeyWatch.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (!existingLate) {
      throw new AppError(400, "departAt must be upcoming for new monitoring");
    }
  }

  const metaPatch = {
    origin: extracted.origin,
    destination: extracted.destination,
    destinationCountry: extracted.destinationCountry,
    product: booking.product,
    ticketRef: booking.externalRef || null,
    companyId: asMeta(booking.metadata).companyId || asMeta(booking.metadata).corporate?.companyId || null,
    checkInDate: extracted.checkInDate,
    confirmationRef: extracted.confirmationRef,
    transferRef: extracted.transferRef,
    transferPickupAt: extracted.transferPickupAt,
    nationality: extracted.nationality,
  };

  const existing = await prisma.journeyWatch.findUnique({
    where: { bookingId },
    select: { id: true, metadata: true },
  });

  let watch;
  try {
    watch = await prisma.journeyWatch.upsert({
      where: { bookingId },
      create: {
        bookingId,
        userId,
        status: "ACTIVE",
        flightNumber: resolvedFlight ?? null,
        departAt: resolvedDepart ?? null,
        arriveAt: resolvedArrive ?? null,
        metadata: metaPatch,
      },
      update: {
        status: "ACTIVE",
        ...(resolvedFlight !== undefined && resolvedFlight !== null
          ? { flightNumber: resolvedFlight }
          : {}),
        ...(resolvedDepart ? { departAt: resolvedDepart } : {}),
        ...(resolvedArrive ? { arriveAt: resolvedArrive } : {}),
        metadata: { ...asMeta(existing?.metadata), ...metaPatch },
      },
      select: WATCH_SELECT,
    });
  } catch (e) {
    // Race: unique bookingId — re-read and update.
    const raced = await prisma.journeyWatch.findUnique({
      where: { bookingId },
      select: { id: true, metadata: true },
    });
    if (!raced) throw e;
    watch = await prisma.journeyWatch.update({
      where: { id: raced.id },
      data: {
        status: "ACTIVE",
        ...(resolvedFlight !== undefined && resolvedFlight !== null
          ? { flightNumber: resolvedFlight }
          : {}),
        ...(resolvedDepart ? { departAt: resolvedDepart } : {}),
        ...(resolvedArrive ? { arriveAt: resolvedArrive } : {}),
        metadata: { ...asMeta(raced.metadata), ...metaPatch },
      },
      select: WATCH_SELECT,
    });
  }

  // Module 03 lifecycle: TICKETED → ACTIVE once JourneyWatch is monitoring.
  try {
    const { markBookingActiveFromJourney } = await import("../bookings/bookings.lifecycle.js");
    await markBookingActiveFromJourney(bookingId, {
      reason: "JourneyWatch monitoring started",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to mark booking ACTIVE from JourneyWatch", { bookingId, err: e });
  }

  return watch;
}

export async function listWatchesForUser(userId, { page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = { userId };

  const [items, total] = await Promise.all([
    prisma.journeyWatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: WATCH_SELECT,
    }),
    prisma.journeyWatch.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getWatchForUser(userId, watchId, permissions) {
  return getOwnedWatchOrThrow(userId, watchId, WATCH_SELECT, permissions);
}

export async function listEventsForWatch(userId, watchId, { page, pageSize } = {}, permissions) {
  await getOwnedWatchOrThrow(userId, watchId, { id: true }, permissions);

  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = { watchId };

  const [items, total] = await Promise.all([
    prisma.journeyEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: EVENT_SELECT,
    }),
    prisma.journeyEvent.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

async function enqueueEventNotifications({ userId, event, dedupeKey, channels }) {
  await enqueueNotificationOutbox(
    channels.map((channel) => ({
      userId,
      channel,
      dedupeKey,
      title: event.title,
      body: event.body ?? event.title,
      payload: {
        module: "journey",
        eventId: event.id,
        watchId: event.watchId,
        type: event.type,
        ...(event.payload && typeof event.payload === "object" ? event.payload : {}),
      },
    })),
  );

  const notifications = await prisma.notificationOutbox.findMany({
    where: { dedupeKey },
    select: NOTIFICATION_SELECT,
  });

  const notifiedEvent = await prisma.journeyEvent.update({
    where: { id: event.id },
    data: { notifiedAt: new Date() },
    select: EVENT_SELECT,
  });

  return { notifiedEvent, notifications };
}

async function recordChangeEvent(watch, change, channels, { dedupeKey: explicitKey } = {}) {
  const fingerprint = change.fingerprint ? String(change.fingerprint) : null;
  const dedupeKey =
    explicitKey ||
    (change.type === "WEATHER" ||
    change.type === "HOTEL_CHECKIN" ||
    change.type === "TRANSFER" ||
    change.type === "IMMIGRATION"
      ? ancillaryDedupeKey(
          change.type === "HOTEL_CHECKIN"
            ? "hotel"
            : change.type === "WEATHER"
              ? "weather"
              : change.type === "TRANSFER"
                ? "transfer"
                : "immigration",
          watch.id,
          fingerprint,
        )
      : journeyChangeDedupeKey(watch.id, change));

  // Notifications already fan'd out for this exact change → skip duplicate event.
  const existingNotif = await prisma.notificationOutbox.findFirst({
    where: { dedupeKey },
    select: { id: true },
  });
  if (existingNotif) {
    return { event: null, notifications: [], skippedDuplicate: true, dedupeKey };
  }

  if (fingerprint) {
    const existingEvent = await prisma.journeyEvent.findUnique({
      where: { watchId_fingerprint: { watchId: watch.id, fingerprint } },
      select: EVENT_SELECT,
    });
    if (existingEvent) {
      if (!existingEvent.notifiedAt) {
        const { notifiedEvent, notifications } = await enqueueEventNotifications({
          userId: watch.userId,
          event: existingEvent,
          dedupeKey,
          channels,
        });
        return { event: notifiedEvent, notifications, skippedDuplicate: false, dedupeKey };
      }
      return { event: existingEvent, notifications: [], skippedDuplicate: true, dedupeKey };
    }
  }

  let event;
  try {
    event = await prisma.journeyEvent.create({
      data: {
        watchId: watch.id,
        type: change.type,
        severity: change.severity,
        title: change.title,
        body: change.body,
        fingerprint,
        payload: {
          ...change.payload,
          fingerprint,
          escalateRecommended: Boolean(change.escalateRecommended),
        },
      },
      select: EVENT_SELECT,
    });
  } catch (e) {
    // Concurrent poll hit unique(watchId, fingerprint) — treat as duplicate.
    if (fingerprint) {
      const raced = await prisma.journeyEvent.findUnique({
        where: { watchId_fingerprint: { watchId: watch.id, fingerprint } },
        select: EVENT_SELECT,
      });
      if (raced) {
        return { event: raced, notifications: [], skippedDuplicate: true, dedupeKey };
      }
    }
    throw e;
  }

  const { notifiedEvent, notifications } = await enqueueEventNotifications({
    userId: watch.userId,
    event,
    dedupeKey,
    channels,
  });

  await writeAudit({
    userId: watch.userId,
    action: "journey.status_change",
    resourceType: "JourneyWatch",
    resourceId: watch.id,
    metadata: {
      eventId: event.id,
      type: change.type,
      fingerprint,
      bookingId: watch.bookingId,
    },
  }).catch(() => {});

  return { event: notifiedEvent, notifications, skippedDuplicate: false, dedupeKey };
}

/**
 * Escalate major disruption. Conversation-backed Module 13 ticket when possible;
 * otherwise audit-only intent (same posture as Module 08 visa escalate).
 */
export async function escalateJourneyDisruption({
  userId,
  watchId,
  conversationId,
  reason,
  event,
  req,
} = {}) {
  if (!userId) throw new AppError(401, "Authentication required");
  const watch = await getOwnedWatchOrThrow(userId, watchId, WATCH_SELECT);

  const payload = {
    reason: reason || "Journey disruption cannot be safely resolved automatically",
    watchId: watch.id,
    bookingId: watch.bookingId,
    flightNumber: watch.flightNumber,
    eventType: event?.type ?? null,
    eventId: event?.id ?? null,
  };

  await writeAudit({
    userId,
    action: "journey.escalate_recommended",
    resourceType: conversationId ? "Conversation" : "JourneyWatch",
    resourceId: conversationId || watch.id,
    req,
    metadata: payload,
  });

  if (!conversationId) {
    return {
      escalated: false,
      auditOnly: true,
      trigger: "JOURNEY_DISRUPTION",
      message:
        "Escalation intent recorded. Provide conversationId to open a Module 13 human handoff ticket.",
      payload,
    };
  }

  try {
    const { createEscalationFromTrigger } = await import(
      "../escalations/escalations.service.js"
    );
    const ticket = await createEscalationFromTrigger({
      conversationId,
      userId,
      trigger: "JOURNEY_DISRUPTION",
      bookingId: watch.bookingId,
      extraContext: { journey: payload },
    });
    return { escalated: true, auditOnly: false, trigger: "JOURNEY_DISRUPTION", ticket, payload };
  } catch (e) {
    return {
      escalated: false,
      auditOnly: true,
      trigger: "JOURNEY_DISRUPTION",
      message: e?.message || "Escalation ticket could not be created",
      payload,
    };
  }
}

async function maybeCompleteWatch(watch) {
  const booking = await prisma.booking.findUnique({
    where: { id: watch.bookingId },
    select: { status: true },
  });
  if (!booking) {
    return prisma.journeyWatch.update({
      where: { id: watch.id },
      data: { status: "COMPLETED" },
      select: WATCH_SELECT,
    });
  }
  if (["CANCELLED", "REFUNDED", "COMPLETED"].includes(booking.status)) {
    return prisma.journeyWatch.update({
      where: { id: watch.id },
      data: { status: "COMPLETED" },
      select: WATCH_SELECT,
    });
  }
  const endAt = watch.arriveAt || watch.departAt;
  if (endAt && new Date(endAt).getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    try {
      const { markBookingCompletedFromJourney } = await import("../bookings/bookings.lifecycle.js");
      await markBookingCompletedFromJourney(watch.bookingId, {
        reason: "JourneyWatch completed after arrival window",
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to mark booking COMPLETED from JourneyWatch", {
        bookingId: watch.bookingId,
        err: e,
      });
    }
    return prisma.journeyWatch.update({
      where: { id: watch.id },
      data: { status: "COMPLETED" },
      select: WATCH_SELECT,
    });
  }
  return null;
}

/**
 * Poll a single ACTIVE watch: flight status + weather/hotel/transfer/immigration.
 * Idle when nothing meaningful changed — only lastPolledAt (+ provider meta) updates.
 */
export async function pollWatch(watchId, opts = {}) {
  const watch = await getWatchOrThrow(watchId);
  if (watch.status !== "ACTIVE") {
    throw new AppError(409, `Cannot poll watch in status ${watch.status}`);
  }

  const completed = await maybeCompleteWatch(watch);
  if (completed) {
    return {
      watch: completed,
      event: null,
      events: [],
      notifications: [],
      provider: getJourneyCapability(),
      dataStatus: "WATCH_COMPLETED",
      changes: [],
    };
  }

  const channels = opts.channels ?? notificationChannelsFromEnv();
  const capability = getJourneyCapability();
  const meta = asMeta(watch.metadata);
  const now = opts.now ?? new Date();

  const booking = await prisma.booking.findUnique({
    where: { id: watch.bookingId },
    select: { id: true, product: true, metadata: true, externalRef: true, status: true },
  });
  const fields = booking
    ? extractJourneyFieldsFromBooking(booking)
    : {
        origin: meta.origin,
        destination: meta.destination,
        destinationCountry: meta.destinationCountry,
        checkInDate: meta.checkInDate,
        confirmationRef: meta.confirmationRef,
        transferRef: meta.transferRef,
        transferPickupAt: meta.transferPickupAt,
        nationality: meta.nationality,
      };

  const events = [];
  const notifications = [];
  let escalateHint = null;

  async function applyChanges(changes, snapshotKey, snapshot) {
    for (const change of changes) {
      const isCriticalDisruption =
        change.type === "CANCELLED" ||
        change.type === "MISSED_CONNECTION" ||
        change.escalateRecommended ||
        (typeof change.severity === "number" && change.severity >= 3);
      const effectiveChannels =
        isCriticalDisruption && !channels.includes("SMS")
          ? [...channels, "SMS"]
          : channels;
      const { event, notifications: n } = await recordChangeEvent(watch, change, effectiveChannels);
      if (event) {
        events.push(event);
        notifications.push(...n);
        if (change.escalateRecommended) escalateHint = change;
      }
    }
    if (snapshotKey && snapshot) {
      meta[snapshotKey] = snapshot;
    }
  }

  async function applyReminder(reminder, kind) {
    if (!reminder) return;
    const { event, notifications: n } = await recordChangeEvent(
      watch,
      reminder,
      channels,
      { dedupeKey: ancillaryDedupeKey(kind, watch.id, reminder.fingerprint) },
    );
    if (event) {
      events.push(event);
      notifications.push(...n);
    }
  }

  // --- Flight live status ---
  const statusResult = await fetchFlightStatus({
    flightNumber: watch.flightNumber,
    departAt: watch.departAt,
    origin: fields.origin || meta.origin,
    destination: fields.destination || meta.destination,
  });

  if (statusResult.isFact && statusResult.snapshot) {
    const changes = detectMeaningfulStatusChanges(meta.lastStatusSnapshot || null, statusResult.snapshot, {
      flightNumber: watch.flightNumber,
    });
    await applyChanges(changes, "lastStatusSnapshot", statusResult.snapshot);
  }

  // Boarding reminder (booking departAt only).
  const boarding = maybeBoardingReminder(watch, {
    now,
    leadMinutes: Number(process.env.JOURNEY_BOARDING_LEAD_MINUTES) || 90,
  });
  if (boarding) {
    const { event, notifications: n } = await recordChangeEvent(watch, boarding, channels, {
      dedupeKey: boardingReminderDedupeKey(watch.id, boarding.fingerprint),
    });
    if (event) {
      events.push(event);
      notifications.push(...n);
    }
  }

  // --- Weather ---
  const weatherResult = await fetchWeatherDisruption({
    origin: fields.origin || meta.origin,
    destination: fields.destination || meta.destination,
    flightNumber: watch.flightNumber,
  });
  if (weatherResult.isFact && weatherResult.snapshot) {
    await applyChanges(
      detectWeatherChanges(meta.lastWeatherSnapshot || null, weatherResult.snapshot),
      "lastWeatherSnapshot",
      weatherResult.snapshot,
    );
  }

  // --- Hotel check-in (schedule reminder + optional live status) ---
  await applyReminder(
    maybeHotelCheckinReminder(
      {
        checkInDate: fields.checkInDate || meta.checkInDate,
        confirmationRef: fields.confirmationRef || meta.confirmationRef,
      },
      { now, leadHours: Number(process.env.JOURNEY_HOTEL_CHECKIN_LEAD_HOURS) || 24 },
    ),
    "hotel",
  );
  if (fields.checkInDate || fields.confirmationRef || booking?.product === "HOTEL") {
    const hotelResult = await fetchHotelCheckInStatus({
      bookingId: watch.bookingId,
      checkInDate: fields.checkInDate || meta.checkInDate,
      confirmationRef: fields.confirmationRef || meta.confirmationRef,
    });
    if (hotelResult.isFact && hotelResult.snapshot) {
      await applyChanges(
        detectHotelStatusChanges(meta.lastHotelSnapshot || null, hotelResult.snapshot),
        "lastHotelSnapshot",
        hotelResult.snapshot,
      );
    }
    meta.lastHotelPoll = {
      dataStatus: hotelResult.dataStatus,
      isFact: hotelResult.isFact,
      reason: hotelResult.reason,
    };
  }

  // --- Airport transfer ---
  await applyReminder(
    maybeTransferReminder(
      {
        transferPickupAt: fields.transferPickupAt || meta.transferPickupAt,
        transferRef: fields.transferRef || meta.transferRef,
      },
      { now, leadMinutes: Number(process.env.JOURNEY_TRANSFER_LEAD_MINUTES) || 180 },
    ),
    "transfer",
  );
  if (fields.transferRef || fields.transferPickupAt || meta.transferRef) {
    const transferResult = await fetchTransferStatus({
      bookingId: watch.bookingId,
      transferRef: fields.transferRef || meta.transferRef,
      pickupAt: fields.transferPickupAt || meta.transferPickupAt,
    });
    if (transferResult.isFact && transferResult.snapshot) {
      await applyChanges(
        detectTransferStatusChanges(meta.lastTransferSnapshot || null, transferResult.snapshot),
        "lastTransferSnapshot",
        transferResult.snapshot,
      );
    }
    meta.lastTransferPoll = {
      dataStatus: transferResult.dataStatus,
      isFact: transferResult.isFact,
      reason: transferResult.reason,
    };
  }

  // --- Immigration advisories ---
  const destCountry =
    fields.destinationCountry ||
    meta.destinationCountry ||
    (fields.destination && String(fields.destination).length === 2 ? fields.destination : null);
  if (destCountry) {
    const immResult = await fetchImmigrationAdvisory({
      destinationCountry: destCountry,
      nationality: fields.nationality || meta.nationality,
    });
    if (immResult.isFact && immResult.snapshot) {
      await applyChanges(
        detectImmigrationChanges(meta.lastImmigrationSnapshot || null, immResult.snapshot),
        "lastImmigrationSnapshot",
        immResult.snapshot,
      );
    }
    meta.lastImmigrationPoll = {
      dataStatus: immResult.dataStatus,
      isFact: immResult.isFact,
      reason: immResult.reason,
    };
  }

  if (escalateHint) {
    await escalateJourneyDisruption({
      userId: watch.userId,
      watchId: watch.id,
      reason: `Automated disruption signal: ${escalateHint.type}`,
      event: events.find((e) => e.type === escalateHint.type) || null,
    }).catch((e) => {
      logger.warn("journey.escalate_failed", { watchId: watch.id, err: e?.message });
    });
  }

  const updatedMeta = {
    ...meta,
    lastPoll: {
      at: new Date().toISOString(),
      dataStatus: statusResult.dataStatus,
      isFact: statusResult.isFact,
      reason: statusResult.reason,
      provider: capability.flightStatus?.provider || capability.provider,
      weather: weatherResult.dataStatus,
    },
    ...(statusResult.snapshot ? { lastStatusSnapshot: statusResult.snapshot } : {}),
  };

  const updatedWatch = await prisma.journeyWatch.update({
    where: { id: watchId },
    data: {
      lastPolledAt: new Date(),
      metadata: updatedMeta,
    },
    select: WATCH_SELECT,
  });

  return {
    watch: updatedWatch,
    event: events[0] || null,
    events,
    notifications,
    provider: capability,
    dataStatus: statusResult.dataStatus,
    isFact: statusResult.isFact,
    reason: statusResult.reason,
    ancillary: {
      weather: weatherResult.dataStatus,
      hotel: meta.lastHotelPoll?.dataStatus ?? null,
      transfer: meta.lastTransferPoll?.dataStatus ?? null,
      immigration: meta.lastImmigrationPoll?.dataStatus ?? null,
    },
    changesDetected: events.length,
  };
}

/**
 * Find alternative flights via Module 03/05 supplier search.
 * Never books or charges — returns live inventory snapshots for traveller choice.
 */
export async function discoverDisruptionAlternatives(userId, watchId, permissions) {
  const watch = await getOwnedWatchOrThrow(userId, watchId, WATCH_SELECT, permissions);
  const booking = await prisma.booking.findUnique({
    where: { id: watch.bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      product: true,
      metadata: true,
    },
  });
  if (!booking || booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }

  const fields = extractJourneyFieldsFromBooking(booking);
  const origin = fields.origin || asMeta(watch.metadata).origin;
  const destination = fields.destination || asMeta(watch.metadata).destination;
  const departureDate = fields.departAt || watch.departAt;

  if (!origin || !destination || !departureDate) {
    return {
      available: false,
      reason: "Booking lacks attributed origin/destination/departureDate for alternative search",
      offers: [],
      autoBooked: false,
    };
  }

  // Corporate soft controls: pass through metadata flag only — pricing/policy stay Module 05/06.
  const corporateMode = asMeta(booking.metadata).corporate || null;

  const { search } = await import("../suppliers/suppliers.service.js");
  const dateStr =
    departureDate instanceof Date
      ? departureDate.toISOString().slice(0, 10)
      : String(departureDate).slice(0, 10);

  const offers = await search({
    product: "FLIGHT",
    userId,
    query: {
      origin,
      destination,
      departureDate: dateStr,
      passengers: 1,
      cabinClass: asMeta(booking.metadata).pricing?.input?.cabinClass || "ECONOMY",
    },
  });

  await writeAudit({
    userId,
    action: "journey.alternatives_searched",
    resourceType: "JourneyWatch",
    resourceId: watch.id,
    metadata: {
      bookingId: booking.id,
      origin,
      destination,
      departureDate: dateStr,
      offerCount: offers.length,
      corporateMode: Boolean(corporateMode),
    },
  }).catch(() => {});

  return {
    available: true,
    origin,
    destination,
    departureDate: dateStr,
    offers: offers.slice(0, 20),
    autoBooked: false,
    note:
      "Alternatives are live supplier inventory. Selecting one requires an explicit Module 03 quote — FlightOne will not auto-rebook or charge.",
    corporateNote: corporateMode
      ? "Corporate trip — existing Module 06 policy controls still apply at quote/reserve."
      : null,
  };
}

/**
 * Safe rebooking handoff: validates ownership + snapshot, does NOT create payment/booking.
 * Traveller must call existing POST /bookings/quote with the snapshot id.
 */
export async function prepareRebookingHandoff(
  userId,
  watchId,
  { supplierOfferSnapshotId } = {},
  permissions,
) {
  if (!supplierOfferSnapshotId) {
    throw new AppError(400, "supplierOfferSnapshotId is required");
  }
  const watch = await getOwnedWatchOrThrow(userId, watchId, WATCH_SELECT, permissions);

  const snapshot = await prisma.supplierOfferSnapshot.findFirst({
    where: { id: supplierOfferSnapshotId, userId },
    select: {
      id: true,
      userId: true,
      supplierCode: true,
      supplierOfferId: true,
      product: true,
      currency: true,
      netMinor: true,
      expiresAt: true,
    },
  });
  if (!snapshot) {
    throw new AppError(404, "Supplier offer snapshot not found for this traveller");
  }
  if (snapshot.expiresAt && new Date(snapshot.expiresAt).getTime() < Date.now()) {
    throw new AppError(409, "Offer snapshot expired — re-search alternatives and revalidate pricing");
  }

  await writeAudit({
    userId,
    action: "journey.rebook_handoff",
    resourceType: "JourneyWatch",
    resourceId: watch.id,
    metadata: {
      bookingId: watch.bookingId,
      supplierOfferSnapshotId: snapshot.id,
      autoBooked: false,
      charged: false,
    },
  }).catch(() => {});

  return {
    authorized: false,
    autoBooked: false,
    charged: false,
    action: "CREATE_QUOTE_REQUIRED",
    watchId: watch.id,
    disruptedBookingId: watch.bookingId,
    quoteHint: {
      supplierOfferSnapshotId: snapshot.id,
      product: snapshot.product,
      // Client must POST /bookings/quote — server revalidates live price (Module 03/05).
    },
    message:
      "Rebooking is not automatic. Create a new quote with this snapshot, then complete payment/reserve through the existing booking flow. Live price/inventory will be revalidated at quote time.",
  };
}

/** Ava grounding: active watches + recent events for the traveller. */
export async function getAvaJourneyContext(userId) {
  const capability = getJourneyCapability();
  const watches = await prisma.journeyWatch.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { departAt: "asc" },
    take: 5,
    select: {
      ...WATCH_SELECT,
      events: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: EVENT_SELECT,
      },
    },
  });

  const lines = [
    "JOURNEY MONITORING (Module 09 — attributed data only):",
    `flightStatus=${capability.flightStatus?.provider || capability.provider}; canPollLive=${capability.flightStatus?.canPollLive ?? capability.canPollLive}; configured=${capability.flightStatus?.configured ?? capability.configured}`,
    `weather=${capability.weather?.provider}; hotel=${capability.hotel?.provider}; transfer=${capability.transfer?.provider}; immigration=${capability.immigration?.provider}`,
  ];
  if (!(capability.flightStatus?.canPollLive ?? capability.canPollLive)) {
    lines.push(
      "Live flight status is unavailable/unconfigured — do not invent delays, gates, cancellations, or ETAs.",
    );
  }
  if (!capability.weather?.canPollLive) {
    lines.push("Weather disruption feed unconfigured — do not invent weather alerts.");
  }
  if (!capability.hotel?.canPollLive) {
    lines.push("Live hotel status unconfigured — only booking check-in dates may be cited.");
  }
  if (!capability.transfer?.canPollLive) {
    lines.push("Live transfer status unconfigured — only booking pickup times may be cited.");
  }
  if (!capability.immigration?.canPollLive) {
    lines.push("Immigration advisory feed unconfigured — do not invent entry/exit advisories.");
  }
  if (!watches.length) {
    lines.push("No ACTIVE monitored journeys for this traveller.");
  } else {
    for (const w of watches) {
      const poll = asMeta(w.metadata).lastPoll;
      lines.push(
        `Watch ${w.id}: flight=${w.flightNumber || "unknown"}; departAt=${w.departAt?.toISOString?.() || w.departAt || "unknown"}; lastDataStatus=${poll?.dataStatus || "never_polled"}`,
      );
      for (const ev of w.events || []) {
        lines.push(`  Event ${ev.type}: ${ev.title}`);
      }
    }
  }
  lines.push(
    "Never invent flight status. For unresolved cancellations/missed connections, recommend human escalation (JOURNEY_DISRUPTION). Never claim a rebook completed unless a Module 03 booking confirms it.",
  );

  return {
    capability,
    watches: watches.map(({ events, ...w }) => ({ ...w, recentEvents: events })),
    promptBlock: lines.join(" "),
  };
}

export async function drainNotifications(limit) {
  const { drainNotificationOutbox } = await import("../../lib/notifications/drain.js");
  return drainNotificationOutbox({ limit });
}

export async function listNotificationsForUser(userId, { status, page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const where = { userId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notificationOutbox.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}
