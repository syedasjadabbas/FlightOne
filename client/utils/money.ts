import type { Money } from "@/types/money";

/** ISO currencies that have no minor subunit — round majors for display. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/**
 * Format Money for display. Always show the ISO currency code (PKR / INR / GBP)
 * so PKR "Rs" and INR "₹" never look like mixed mystery symbols.
 * Formatting happens only at the edge (dev guide §5).
 */
export function formatMoney(m: Money, _locale = "en-US"): string {
  const currency = (m.currency || "PKR").toUpperCase();
  const major = m.amount / 100;
  // PKR (and true 0-decimal ISO currencies): round to whole units — travellers
  // never expect "PKR 144,569.97" from fare math that stores minor subunits.
  const roundWhole = currency === "PKR" || ZERO_DECIMAL_CURRENCIES.has(currency);
  const displayMajor = roundWhole ? Math.round(major) : major;
  const amount =
    roundWhole || m.amount % 100 === 0
      ? displayMajor.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : displayMajor.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  return `${currency} ${amount}`;
}

/**
 * Format a raw integer-minor-units amount (e.g. a server response field like
 * `revenueMinor`) without constructing a `Money` value first. Still edge-only
 * `amount / 100` — never propagate a divided float back through app state
 * (dev guide §5: no float money math).
 */
export function formatMinorAmount(
  amountMinor: number,
  currency = "USD",
  locale = "en-US",
): string {
  return formatMoney({ amount: amountMinor, currency }, locale);
}
