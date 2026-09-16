/**
 * Travelport workbench ticketing (post-hold).
 * Never invents ticket numbers. FlightOne already captured payment — FOP is
 * agency/cash accounting, not a second card charge.
 *
 * POST /book/session/reservationworkbench/buildfromlocator?Locator=
 * POST /payment/reservationworkbench/{id}/formofpayment
 * POST /paymentoffer/reservationworkbench/{id}/payments
 * POST /book/reservation/reservations/{workbenchID}
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";
import { extractWorkbenchId } from "./workbench.js";

function walkTicketNumbers(node, acc) {
  if (!node || acc.length > 40) return;
  if (typeof node === "string") {
    const t = node.trim();
    if (/^\d{10,14}$/.test(t) && !acc.includes(t)) acc.push(t);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkTicketNumbers(item, acc);
    return;
  }
  if (typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (/ticketnumber|documentnumber|ticketdoc/i.test(key) && typeof value === "string") {
      const t = value.trim();
      if (t && !acc.includes(t)) acc.push(t);
    } else if (/ticketnumber|documentnumber/i.test(key) && value && typeof value === "object" && typeof value.value === "string") {
      const t = value.value.trim();
      if (t && !acc.includes(t)) acc.push(t);
    } else {
      walkTicketNumbers(value, acc);
    }
  }
}

export function extractTicketNumbers(json) {
  const acc = [];
  walkTicketNumbers(json, acc);
  return acc;
}

/**
 * @returns {Promise<{ status: "ok"|"failed"|"unconfigured", externalRef?: string|null, ticketNumbers?: string[], details?: object }>}
 */
export async function ticketHeldReservationWithTravelport(booking) {
  if (!isTravelportConfigured()) {
    return { status: "unconfigured", details: { reason: "Travelport credentials are not configured" } };
  }

  const locator = typeof booking?.externalRef === "string" ? booking.externalRef.trim() : "";
  if (!locator) {
    return { status: "failed", details: { reason: "No supplier locator to ticket" } };
  }

  const existing = booking?.metadata?.supplierBooking?.ticket?.ticketNumbers;
  if (Array.isArray(existing) && existing.length > 0) {
    return {
      status: "ok",
      externalRef: locator,
      ticketNumbers: existing,
      details: { idempotent: true },
    };
  }

  const traceId = `fo-tkt-${randomUUID()}`;
  try {
    const session = await travelportFetch(
      `/book/session/reservationworkbench/buildfromlocator?Locator=${encodeURIComponent(locator)}`,
      { method: "POST", body: {}, traceId: `${traceId}-wb` },
    );
    const workbenchId = extractWorkbenchId(session.json);
    if (!workbenchId) {
      return {
        status: "failed",
        details: { reason: "Travelport did not return a ticketing workbench id", traceId },
      };
    }

    const fop = await travelportFetch(
      `/payment/reservationworkbench/${encodeURIComponent(workbenchId)}/formofpayment`,
      {
        method: "POST",
        traceId: `${traceId}-fop`,
        body: {
          FormOfPayment: {
            "@type": "FormOfPaymentCash",
            Identifier: { value: `fo-cash-${booking.id}` },
          },
        },
        allowHttpError: true,
      },
    );
    if (fop.status >= 400) {
      return {
        status: "failed",
        details: {
          reason: fop.error || "Travelport rejected agency/cash form of payment",
          traceId,
          workbenchId,
          hint: "Live ticketing requires a PCC-accepted FOP; FlightOne does not send PAN/CVV",
        },
      };
    }

    const pay = await travelportFetch(
      `/paymentoffer/reservationworkbench/${encodeURIComponent(workbenchId)}/payments`,
      {
        method: "POST",
        traceId: `${traceId}-pay`,
        body: {
          Payment: {
            "@type": "Payment",
            Identifier: { value: `fo-pay-${booking.id}` },
          },
        },
        allowHttpError: true,
      },
    );
    if (pay.status >= 400) {
      return {
        status: "failed",
        details: {
          reason: pay.error || "Travelport payment-offer step failed",
          traceId,
          workbenchId,
        },
      };
    }

    const commit = await travelportFetch(
      `/book/reservation/reservations/${encodeURIComponent(workbenchId)}`,
      { method: "POST", traceId: `${traceId}-commit`, body: {} },
    );

    const ticketNumbers = extractTicketNumbers(commit.json);
    if (!ticketNumbers.length) {
      return {
        status: "failed",
        details: {
          reason: "Travelport ticket commit returned no ticket numbers",
          traceId,
          workbenchId,
        },
      };
    }

    return {
      status: "ok",
      externalRef: locator,
      ticketNumbers,
      details: { traceId, workbenchId, source: "travelport" },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport ticketing failed", traceId },
    };
  }
}
