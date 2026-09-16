/**
 * Country → ISO 4217 for pitching / Stays requestedCurrency.
 * FlightOne Pakistan POS defaults to PKR; elsewhere use local major currency.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  PK: "PKR",
  IN: "INR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  US: "USD",
  GB: "GBP",
  UK: "GBP",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  IE: "EUR",
  BE: "EUR",
  AT: "EUR",
  SG: "SGD",
  MY: "MYR",
  TH: "THB",
  TR: "TRY",
  EG: "EGP",
  MA: "MAD",
  LK: "LKR",
  MV: "USD",
  CN: "CNY",
  JP: "JPY",
  KR: "KRW",
  HK: "HKD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  ZA: "ZAR",
  BR: "BRL",
};

export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return "PKR";
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] || "USD";
}

/** Intl locale hint for formatMoney */
export function localeForCurrency(currency: string): string {
  switch (currency.toUpperCase()) {
    case "PKR":
      return "en-PK";
    case "INR":
      return "en-IN";
    case "GBP":
      return "en-GB";
    case "EUR":
      return "en-IE";
    case "AED":
      return "en-AE";
    default:
      return "en-US";
  }
}
