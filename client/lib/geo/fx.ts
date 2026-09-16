import type { Money } from "@/types/money";
import type { Offer } from "@/lib/inventory/types";

/**
 * Approximate units of each currency per 1 USD — display-only FX so cards never
 * mix PKR / INR / USD when Travelport ignores PricingModifiersAir.
 * Update periodically; not for booking settlement.
 */
const UNITS_PER_USD: Record<string, number> = {
  USD: 1,
  PKR: 278,
  INR: 83.5,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.376,
  OMR: 0.385,
  CAD: 1.36,
  AUD: 1.53,
  NZD: 1.66,
  SGD: 1.34,
  MYR: 4.7,
  THB: 35.5,
  TRY: 32.5,
  EGP: 48,
  MAD: 10,
  LKR: 300,
  CNY: 7.25,
  JPY: 150,
  KRW: 1350,
  HKD: 7.8,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.9,
  ZAR: 18.5,
  BRL: 5.5,
};

/** Convert minor-unit money into `target` using the rate table. */
export function convertMoney(m: Money, target: string): Money {
  const from = (m.currency || "USD").toUpperCase();
  const to = (target || from).toUpperCase();
  if (from === to) return { amount: m.amount, currency: to };

  const fromRate = UNITS_PER_USD[from];
  const toRate = UNITS_PER_USD[to];
  if (!fromRate || !toRate) {
    return { amount: m.amount, currency: from };
  }

  return {
    amount: Math.round((m.amount / fromRate) * toRate),
    currency: to,
  };
}

/** Rewrite net + market prices onto one currency for ranking and display. */
export function convertOfferToCurrency(offer: Offer, target: string): Offer {
  const currency = (target || "PKR").toUpperCase();
  return {
    ...offer,
    netFare: convertMoney(offer.netFare, currency),
    marketPrice: convertMoney(offer.marketPrice, currency),
  };
}

export function convertOffersToCurrency(offers: Offer[], target: string): Offer[] {
  return offers.map((o) => convertOfferToCurrency(o, target));
}
