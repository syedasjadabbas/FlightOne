/**
 * Travelport TripServices Air Exchange & Reissue integration.
 *
 * POST /price/offers/buildfromexchange
 * POST /air/exchange/quote
 * POST /air/exchange/reissue
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";

/**
 * Quote flight exchange / reissue costs for an existing ticket.
 *
 * @param {{
 *   locator?: string,
 *   ticketNumber?: string,
 *   newFlightOffer?: object,
 *   currentNetMinor?: number,
 *   currency?: string,
 * }} params
 * @returns {Promise<{
 *   status: "ok"|"unconfigured"|"failed",
 *   quote?: {
 *     changeFeeMinor: number,
 *     fareDifferenceMinor: number,
 *     taxDifferenceMinor: number,
 *     totalCostMinor: number,
 *     currency: string,
 *     quoteId: string,
 *   },
 *   details?: object,
 * }>}
 */
export async function quoteTravelportExchange(params = {}) {
  const ticketNumber = params.ticketNumber || "";
  const locator = params.locator || "";
  if (!ticketNumber && !locator) {
    return { status: "failed", details: { reason: "Ticket number or locator required for exchange quote" } };
  }

  if (!isTravelportConfigured()) {
    // Deterministic simulation based on current net and new offer
    const current = Number(params.currentNetMinor) || 28000;
    const nextAmount = Number(params.newFlightOffer?.amountMinor || params.newFlightOffer?.netMinor) || 35000;
    const changeFeeMinor = 7500;
    const fareDifferenceMinor = Math.max(0, nextAmount - current);
    const taxDifferenceMinor = 1200;
    const totalCostMinor = changeFeeMinor + fareDifferenceMinor + taxDifferenceMinor;

    return {
      status: "unconfigured",
      quote: {
        changeFeeMinor,
        fareDifferenceMinor,
        taxDifferenceMinor,
        totalCostMinor,
        currency: params.currency || "USD",
        quoteId: `EXQ-SIM-${randomUUID().slice(0, 8)}`,
      },
      details: { reason: "Travelport unconfigured — simulated exchange quote" },
    };
  }

  const traceId = `fo-exq-${randomUUID()}`;
  try {
    const body = {
      AirExchangeQuoteQuery: {
        TicketNumber: { value: ticketNumber },
        Locator: locator ? { value: locator } : undefined,
        NewOffer: params.newFlightOffer ? { Identifier: { value: params.newFlightOffer.offerId } } : undefined,
      },
    };

    const res = await travelportFetch("/air/exchange/quote", {
      method: "POST",
      body,
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      const q = res.json?.AirExchangeQuoteResponse || res.json;
      return {
        status: "ok",
        quote: {
          changeFeeMinor: q.changeFeeMinor ?? 0,
          fareDifferenceMinor: q.fareDifferenceMinor ?? 0,
          taxDifferenceMinor: q.taxDifferenceMinor ?? 0,
          totalCostMinor: q.totalCostMinor ?? 0,
          currency: q.currency || params.currency || "USD",
          quoteId: q.quoteId || traceId,
        },
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport exchange quote failed", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport exchange quote failed", traceId },
    };
  }
}

/**
 * Reissue ticket for modified itinerary.
 *
 * @param {{
 *   locator: string,
 *   ticketNumber: string,
 *   quoteId: string,
 *   fop?: string,
 * }} params
 */
export async function reissueTravelportTicket(params = {}) {
  if (!params.locator || !params.ticketNumber) {
    return { status: "failed", details: { reason: "Locator and ticketNumber required for reissue" } };
  }

  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      details: { reason: "Travelport unconfigured — cannot execute live ticket reissue" },
    };
  }

  const traceId = `fo-reis-${randomUUID()}`;
  try {
    const res = await travelportFetch("/air/exchange/reissue", {
      method: "POST",
      body: {
        ReissueRequest: {
          Locator: { value: params.locator },
          OldTicketNumber: { value: params.ticketNumber },
          QuoteIdentifier: { value: params.quoteId },
        },
      },
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      return {
        status: "ok",
        newTicketNumber: res.json?.newTicketNumber || res.json?.TicketNumber?.value,
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport reissue failed", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport reissue failed", traceId },
    };
  }
}
