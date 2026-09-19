/**
 * Travelport TripServices Void & Refund integration.
 *
 * POST /air/ticket/tickets/{ticketNumber}/void
 * POST /air/ticket/refundquote
 * POST /air/ticket/refund
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";

/**
 * Void a ticket within the void window (usually same calendar day or 24 hours).
 *
 * @param {string} ticketNumber
 * @param {{ locator?: string, reason?: string }} [opts]
 * @returns {Promise<{ status: "ok"|"failed"|"unconfigured", ticketNumber?: string, details?: object }>}
 */
export async function voidTravelportTicket(ticketNumber, opts = {}) {
  const tkt = typeof ticketNumber === "string" ? ticketNumber.trim() : "";
  if (!tkt) {
    return { status: "failed", details: { reason: "Ticket number required for void" } };
  }

  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      details: { reason: "Travelport unconfigured — cannot void live ticket" },
    };
  }

  const traceId = `fo-void-${randomUUID()}`;
  try {
    const encoded = encodeURIComponent(tkt);
    const res = await travelportFetch(`/air/ticket/tickets/${encoded}/void`, {
      method: "POST",
      body: {
        TicketVoid: {
          TicketNumber: { value: tkt },
          Locator: opts.locator ? { value: opts.locator } : undefined,
          Reason: opts.reason || "Customer requested void within window",
        },
      },
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300) {
      return {
        status: "ok",
        ticketNumber: tkt,
        details: { traceId, source: "travelport", voidedAt: new Date().toISOString() },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport void failed", traceId, status: res.status },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport void call failed", traceId },
    };
  }
}

/**
 * Quote refund amounts and penalties for an issued ticket.
 *
 * @param {{
 *   ticketNumber?: string,
 *   locator?: string,
 *   amountMinor?: number,
 *   currency?: string,
 *   fareRules?: object,
 * }} params
 * @returns {Promise<{
 *   status: "ok"|"unconfigured"|"failed",
 *   quote?: {
 *     grossFareMinor: number,
 *     penaltyMinor: number,
 *     netRefundMinor: number,
 *     currency: string,
 *     refundable: boolean,
 *   },
 *   details?: object,
 * }>}
 */
export async function quoteTravelportRefund(params = {}) {
  const tkt = params.ticketNumber || "";
  if (!tkt && !params.locator) {
    return { status: "failed", details: { reason: "Ticket number or locator required for refund quote" } };
  }

  if (!isTravelportConfigured()) {
    const gross = Number(params.amountMinor) || 35000;
    const isRefundable = params.fareRules?.refundable !== false;
    const penalty = isRefundable ? 5000 : gross;
    const netRefund = Math.max(0, gross - penalty);

    return {
      status: "unconfigured",
      quote: {
        grossFareMinor: gross,
        penaltyMinor: penalty,
        netRefundMinor: netRefund,
        currency: params.currency || "USD",
        refundable: isRefundable,
      },
      details: { reason: "Travelport unconfigured — simulated refund calculation" },
    };
  }

  const traceId = `fo-rfq-${randomUUID()}`;
  try {
    const res = await travelportFetch("/air/ticket/refundquote", {
      method: "POST",
      body: {
        TicketRefundQuoteQuery: {
          TicketNumber: tkt ? { value: tkt } : undefined,
          Locator: params.locator ? { value: params.locator } : undefined,
        },
      },
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      const q = res.json?.RefundQuoteResponse || res.json;
      return {
        status: "ok",
        quote: {
          grossFareMinor: q.grossFareMinor ?? params.amountMinor ?? 0,
          penaltyMinor: q.penaltyMinor ?? 0,
          netRefundMinor: q.netRefundMinor ?? 0,
          currency: q.currency || params.currency || "USD",
          refundable: q.refundable !== false,
        },
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport refund quote query failed", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport refund quote failed", traceId },
    };
  }
}
