/**
 * Module 09 — ancillary change detection + schedule reminders (no fabrication).
 */

export function ancillaryDedupeKey(kind, watchId, fingerprint) {
  return `journey-${kind}:${watchId}:${fingerprint || "none"}`;
}

export function detectWeatherChanges(previous, current) {
  if (!current || !current.alertId && !current.title && !current.summary) return [];
  const prev = previous || {};
  const fp = `${current.alertId || "alert"}:${current.severity || ""}:${current.title || ""}`;
  if (prev.alertId === current.alertId && prev.title === current.title && prev.severity === current.severity) {
    return [];
  }
  return [
    {
      type: "WEATHER",
      severity: ["SEVERE", "HIGH", "3", "4", "5"].includes(String(current.severity).toUpperCase())
        ? 2
        : 1,
      title: current.title || `Weather disruption near ${current.airportCode || "airport"}`,
      body:
        current.summary ||
        "Attributed weather disruption from configured weather provider. Verify with local authorities.",
      fingerprint: fp,
      payload: {
        airportCode: current.airportCode,
        alertId: current.alertId,
        severity: current.severity,
        source: current.source,
      },
      escalateRecommended: ["SEVERE", "HIGH", "4", "5"].includes(
        String(current.severity).toUpperCase(),
      ),
    },
  ];
}

export function detectHotelStatusChanges(previous, current) {
  if (!current?.status || current.status === "UNKNOWN") return [];
  const prev = previous || {};
  if (prev.status === current.status) return [];
  return [
    {
      type: "HOTEL_CHECKIN",
      severity: current.status === "CANCELLED" || current.status === "NO_SHOW" ? 2 : 0,
      title: `Hotel status now ${current.status}`,
      body:
        current.note ||
        "Attributed hotel status from configured hotel-status provider (not invented).",
      fingerprint: `hotel:${prev.status || "none"}->${current.status}:${current.confirmationRef || ""}`,
      payload: {
        previousStatus: prev.status || null,
        status: current.status,
        confirmationRef: current.confirmationRef,
        checkInDate: current.checkInDate,
      },
      escalateRecommended: current.status === "CANCELLED",
    },
  ];
}

export function detectTransferStatusChanges(previous, current) {
  if (!current?.status || current.status === "UNKNOWN") return [];
  const prev = previous || {};
  if (prev.status === current.status) return [];
  return [
    {
      type: "TRANSFER",
      severity: current.status === "CANCELLED" || current.status === "NO_SHOW" ? 2 : 0,
      title: `Transfer status now ${current.status}`,
      body:
        current.note ||
        "Attributed airport-transfer status from configured transfer provider (not invented).",
      fingerprint: `transfer:${prev.status || "none"}->${current.status}:${current.transferRef || ""}`,
      payload: {
        previousStatus: prev.status || null,
        status: current.status,
        transferRef: current.transferRef,
        pickupAt: current.pickupAt,
      },
      escalateRecommended: current.status === "CANCELLED",
    },
  ];
}

export function detectImmigrationChanges(previous, current) {
  if (!current?.advisoryId && !current?.title && !current?.summary) return [];
  const prev = previous || {};
  const fp = `${current.advisoryId || "adv"}:${current.title || ""}`;
  if (prev.advisoryId === current.advisoryId && prev.title === current.title) return [];
  return [
    {
      type: "IMMIGRATION",
      severity: 1,
      title: current.title || `Immigration advisory for ${current.destinationCountry || "destination"}`,
      body:
        (current.summary ? `${current.summary.slice(0, 280)}` : "Attributed immigration advisory.") +
        " This is not a visa eligibility determination (see Module 08).",
      fingerprint: fp,
      payload: {
        advisoryId: current.advisoryId,
        destinationCountry: current.destinationCountry,
        source: current.source,
        lastVerifiedAt: current.lastVerifiedAt,
      },
      escalateRecommended: false,
    },
  ];
}

/**
 * Hotel check-in reminder from attributed booking checkInDate only.
 * Does not invent room readiness or confirmation status.
 */
export function maybeHotelCheckinReminder(fields, { now = new Date(), leadHours = 24 } = {}) {
  if (!fields?.checkInDate) return null;
  const checkIn = new Date(fields.checkInDate);
  if (Number.isNaN(checkIn.getTime())) return null;
  const msUntil = checkIn.getTime() - now.getTime();
  const leadMs = leadHours * 3600_000;
  // Reminder window: from leadHours before check-in through end of check-in day (+12h).
  if (msUntil > leadMs || msUntil < -12 * 3600_000) return null;
  const iso = checkIn.toISOString().slice(0, 10);
  return {
    type: "HOTEL_CHECKIN",
    severity: 0,
    title: "Hotel check-in approaching",
    body: `Your booking lists check-in on ${iso}. This reminder uses booking data only — live room/status requires a configured hotel-status provider.`,
    fingerprint: `checkin-reminder:${iso}`,
    payload: {
      checkInDate: iso,
      source: "booking_schedule",
      confirmationRef: fields.confirmationRef || null,
    },
    escalateRecommended: false,
  };
}

/**
 * Transfer pickup reminder from attributed booking transfer.pickupAt only.
 */
export function maybeTransferReminder(fields, { now = new Date(), leadMinutes = 180 } = {}) {
  if (!fields?.transferPickupAt) return null;
  const pickup = new Date(fields.transferPickupAt);
  if (Number.isNaN(pickup.getTime())) return null;
  const msUntil = pickup.getTime() - now.getTime();
  const leadMs = leadMinutes * 60_000;
  if (msUntil < 0 || msUntil > leadMs) return null;
  const iso = pickup.toISOString();
  return {
    type: "TRANSFER",
    severity: 0,
    title: "Airport transfer pickup approaching",
    body: `Your booking lists transfer pickup at ${iso}. This reminder uses booking data only — live transfer status requires a configured transfer provider.`,
    fingerprint: `transfer-reminder:${iso}`,
    payload: {
      pickupAt: iso,
      source: "booking_schedule",
      transferRef: fields.transferRef || null,
    },
    escalateRecommended: false,
  };
}
