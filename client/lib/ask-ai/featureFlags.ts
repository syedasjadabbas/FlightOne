/** Frontend feature flags — UI/data contracts ready before backend exists. */
export const FEATURE_FLAGS = {
  priceForecast: process.env.NEXT_PUBLIC_PRICE_FORECAST === "true",
  priceAlerts: process.env.NEXT_PUBLIC_PRICE_ALERTS !== "false",
  priceCalendar: process.env.NEXT_PUBLIC_PRICE_CALENDAR !== "false",
  hackerFares: process.env.NEXT_PUBLIC_HACKER_FARES === "true",
} as const;
