import type { Money } from "@/types/money";
import { applyPct, savings, savingsPct, minor } from "@/types/money";
import type { Offer } from "@/lib/inventory/types";

/**
 * Pricing & Margin Engine — Module 05 (display path).
 *
 * Search/recommendation UI uses these product defaults so displayed prices
 * match the server engine's flight 9% / hotel 14% when no MarkupRule applies.
 *
 * Authoritative sell prices for quote → reserve → ticket are ALWAYS computed
 * by `filght-one-server/modules/pricing/pricing.service.js`. Client-supplied
 * amounts are never trusted at booking time.
 */

export interface PricingConfig {
  /** Markup applied to the net fare, by offer type. */
  markupPct: Record<Offer["type"], number>;
  /**
   * Max % the AI may knock off the CUSTOMER price on its own authority.
   * Anything deeper is a human-agent escalation (Module 13), never a bypass.
   */
  aiMaxDiscountPct: number;
  /** Minimum margin % over net we always keep — the AI floor can't go below it. */
  minMarginPct: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  markupPct: { flight: 9, hotel: 14, package: 18 },
  aiMaxDiscountPct: 8,
  minMarginPct: 4,
};

export interface PricedOffer {
  offer: Offer;
  /** What we'd quote the customer right now. */
  customerPrice: Money;
  /** customerPrice − netFare (our gross margin at list price). */
  marginMinor: number;
  /** Positive = we're cheaper than the OTA market price. */
  savingsVsMarket: Money;
  savingsVsMarketPct: number;
  /** True when we can honestly claim to beat the major platforms. */
  hasMarketEdge: boolean;
  /** Deepest price the AI may offer unilaterally (negotiation buffer applied). */
  aiFloorPrice: Money;
  /** Whether there's meaningful room left to sweeten a deal. */
  hasNegotiationRoom: boolean;
}

export function priceOffer(offer: Offer, cfg: PricingConfig = DEFAULT_PRICING): PricedOffer {
  // Server Module 05 sell price wins — never double-apply local markup.
  const customerPrice =
    offer.serverSellPrice &&
    offer.serverSellPrice.currency === offer.netFare.currency &&
    Number.isInteger(offer.serverSellPrice.amount) &&
    offer.serverSellPrice.amount > 0
      ? offer.serverSellPrice
      : applyPct(offer.netFare, cfg.markupPct[offer.type]);
  const marginMinor = customerPrice.amount - offer.netFare.amount;

  const sVsMarket = savings(customerPrice, offer.marketPrice);
  const sPct = savingsPct(customerPrice, offer.marketPrice);

  // Live Travelport DTOs use a synthetic market uplift — never claim OTA beats on those.
  const marketIsEstimated =
    offer.tags.includes("live") ||
    offer.tags.includes("travelport") ||
    offer.tags.includes("gds") ||
    offer.tags.includes("stays") ||
    offer.tags.includes("web-meta");

  // Floor = the lower of (customerPrice − aiMaxDiscount) and (net + minMargin),
  // but never below net+minMargin. i.e. AI can discount up to its cap, but the
  // hard margin floor always wins.
  const discountFloor = applyPct(customerPrice, -cfg.aiMaxDiscountPct);
  const marginFloor = applyPct(offer.netFare, cfg.minMarginPct);
  const aiFloorPrice: Money = minor(
    Math.max(discountFloor.amount, marginFloor.amount),
    customerPrice.currency,
  );

  return {
    offer,
    customerPrice,
    marginMinor,
    savingsVsMarket: sVsMarket,
    savingsVsMarketPct: sPct,
    hasMarketEdge: !marketIsEstimated && sVsMarket.amount > 0,
    aiFloorPrice,
    hasNegotiationRoom: customerPrice.amount - aiFloorPrice.amount > 0,
  };
}

export function priceAll(offers: Offer[], cfg?: PricingConfig): PricedOffer[] {
  return offers.map((o) => priceOffer(o, cfg));
}
