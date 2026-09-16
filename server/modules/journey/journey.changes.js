/**
 * Module 09 — meaningful journey change detection (no fabrication).
 * Compares attributed live snapshots only.
 */

/**
 * Build a stable fingerprint for notification dedupe.
 * Same watch + same change signature → same key across polls.
 */
export function journeyChangeDedupeKey(watchId, change) {
  const type = change?.type || "OTHER";
  const fp = change?.fingerprint || "none";
  return `journey-change:${watchId}:${type}:${fp}`;
}

export function boardingReminderDedupeKey(watchId, departAtIso) {
  return `journey-boarding:${watchId}:${departAtIso || "unknown"}`;
}

/**
 * Diff previous vs current attributed snapshots.
 * @returns {Array<{
 *   type: string,
 *   severity: number,
 *   title: string,
 *   body: string,
 *   fingerprint: string,
 *   payload: object,
 *   escalateRecommended: boolean,
 * }>}
 */
export function detectMeaningfulStatusChanges(previous, current, { flightNumber } = {}) {
  if (!current || typeof current !== "object") return [];
  const prev = previous && typeof previous === "object" ? previous : {};
  const label = flightNumber || current.flightNumber || "Flight";
  const changes = [];

  if (current.status && current.status !== prev.status) {
    if (current.status === "CANCELLED") {
      changes.push({
        type: "CANCELLED",
        severity: 3,
        title: `${label} cancelled`,
        body: "Live status reports this flight as cancelled. Automated resolution is not assumed — human help may be needed.",
        fingerprint: `cancelled:${current.status}`,
        payload: { status: current.status, previousStatus: prev.status || null },
        escalateRecommended: true,
      });
    } else if (current.status === "DELAYED" || (current.minutesDelayed != null && current.minutesDelayed > 0)) {
      const minutes = current.minutesDelayed;
      changes.push({
        type: "DELAY",
        severity: minutes != null && minutes >= 90 ? 2 : 1,
        title:
          minutes != null
            ? `${label} delayed ${minutes}m`
            : `${label} marked delayed`,
        body:
          minutes != null
            ? `Attributed delay of ${minutes} minutes from live status provider.`
            : "Live status reports a delay (exact minutes not provided by provider).",
        fingerprint: `delay:${current.status}:${minutes ?? "unknown"}:${current.estimatedDepartAt || ""}`,
        payload: {
          status: current.status,
          minutesDelayed: minutes,
          estimatedDepartAt: current.estimatedDepartAt,
        },
        escalateRecommended: minutes != null && minutes >= 120,
      });
    } else if (
      prev.status &&
      current.status !== "UNKNOWN" &&
      current.status !== "SCHEDULED"
    ) {
      // Only notify non-routine status transitions when we already had a prior snapshot.
      changes.push({
        type: "OTHER",
        severity: current.status === "DIVERTED" ? 2 : 0,
        title: `${label} status now ${current.status}`,
        body: `Attributed status change from live provider (${prev.status} → ${current.status}).`,
        fingerprint: `status:${prev.status}->${current.status}`,
        payload: { previousStatus: prev.status, status: current.status },
        escalateRecommended: current.status === "DIVERTED",
      });
    }
  } else if (
    current.minutesDelayed != null &&
    current.minutesDelayed !== prev.minutesDelayed &&
    current.minutesDelayed > 0
  ) {
    changes.push({
      type: "DELAY",
      severity: current.minutesDelayed >= 90 ? 2 : 1,
      title: `${label} delayed ${current.minutesDelayed}m`,
      body: `Attributed delay updated to ${current.minutesDelayed} minutes.`,
      fingerprint: `delay-mins:${current.minutesDelayed}:${current.estimatedDepartAt || ""}`,
      payload: {
        minutesDelayed: current.minutesDelayed,
        previousMinutesDelayed: prev.minutesDelayed ?? null,
        estimatedDepartAt: current.estimatedDepartAt,
      },
      escalateRecommended: current.minutesDelayed >= 120,
    });
  }

  if (current.gate && current.gate !== prev.gate) {
    changes.push({
      type: "GATE_CHANGE",
      severity: 0,
      title: `${label} gate changed to ${current.gate}`,
      body: `New departure gate (attributed): ${current.gate}.`,
      fingerprint: `gate:${prev.gate || "none"}->${current.gate}`,
      payload: { previousGate: prev.gate || null, newGate: current.gate },
      escalateRecommended: false,
    });
  }

  if (current.terminal && current.terminal !== prev.terminal) {
    changes.push({
      type: "TERMINAL_CHANGE",
      severity: 0,
      title: `${label} terminal changed to ${current.terminal}`,
      body: `New terminal (attributed): ${current.terminal}.`,
      fingerprint: `terminal:${prev.terminal || "none"}->${current.terminal}`,
      payload: { previousTerminal: prev.terminal || null, newTerminal: current.terminal },
      escalateRecommended: false,
    });
  }

  const prevEtd = prev.estimatedDepartAt || prev.scheduledDepartAt || null;
  const nextEtd = current.estimatedDepartAt || null;
  if (nextEtd && prevEtd && nextEtd !== prevEtd && current.status !== "CANCELLED") {
    // Schedule change distinct from delay minutes when provider only shifts ETD.
    const alreadyDelay = changes.some((c) => c.type === "DELAY");
    if (!alreadyDelay) {
      changes.push({
        type: "OTHER",
        severity: 1,
        title: `${label} departure time updated`,
        body: `Estimated departure changed (attributed): ${nextEtd}.`,
        fingerprint: `etd:${prevEtd}->${nextEtd}`,
        payload: { previousEstimatedDepartAt: prevEtd, estimatedDepartAt: nextEtd },
        escalateRecommended: false,
      });
    }
  }

  return changes;
}

/**
 * Time-based boarding reminder using attributed booking departAt only.
 * Does not invent gates or security wait times.
 */
export function maybeBoardingReminder(watch, { now = new Date(), leadMinutes = 90 } = {}) {
  if (!watch?.departAt) return null;
  const depart = new Date(watch.departAt);
  if (Number.isNaN(depart.getTime())) return null;
  const msUntil = depart.getTime() - now.getTime();
  const leadMs = leadMinutes * 60_000;
  if (msUntil < 0 || msUntil > leadMs) return null;
  const departIso = depart.toISOString();
  return {
    type: "BOARDING",
    severity: 0,
    title: `Boarding window approaching for ${watch.flightNumber || "your flight"}`,
    body: `Scheduled departure ${departIso}. This reminder uses your booking schedule only — live gate/boarding status requires a configured status provider.`,
    fingerprint: departIso,
    payload: { departAt: departIso, leadMinutes, source: "booking_schedule" },
    escalateRecommended: false,
  };
}
