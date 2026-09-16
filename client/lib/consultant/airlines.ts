/**
 * Map natural language / IATA mentions → preferred carrier codes for soft ranking.
 */

const ALIASES: { pattern: RegExp; code: string; name: string }[] = [
  { pattern: /\bqatar(\s+airways)?\b/i, code: "QR", name: "Qatar Airways" },
  { pattern: /\bqr\b/i, code: "QR", name: "Qatar Airways" },
  { pattern: /\bsaudia\b|\bsaudi\s+arabian\b|\bsaudi\s+airlines?\b/i, code: "SV", name: "Saudia" },
  { pattern: /\bsv\b/i, code: "SV", name: "Saudia" },
  { pattern: /\bemirates\b/i, code: "EK", name: "Emirates" },
  { pattern: /\bek\b/i, code: "EK", name: "Emirates" },
  { pattern: /\betihad\b/i, code: "EY", name: "Etihad" },
  { pattern: /\bey\b/i, code: "EY", name: "Etihad" },
  { pattern: /\bpia\b|\bpakistan\s+international\b/i, code: "PK", name: "PIA" },
  { pattern: /\bturkish(\s+airlines?)?\b/i, code: "TK", name: "Turkish Airlines" },
  { pattern: /\btk\b/i, code: "TK", name: "Turkish Airlines" },
  { pattern: /\bsingapore\s+airlines?\b|\bsq\b/i, code: "SQ", name: "Singapore Airlines" },
  { pattern: /\bba\b|\bbritish\s+airways\b/i, code: "BA", name: "British Airways" },
  { pattern: /\bthai(\s+airways?)?\b|\btg\b/i, code: "TG", name: "Thai Airways" },
  { pattern: /\bsrirlankan\b|\bul\b/i, code: "UL", name: "SriLankan" },
  { pattern: /\boman(\s+air)?\b|\bwy\b/i, code: "WY", name: "Oman Air" },
  { pattern: /\bcathay(\s+pacific)?\b|\bcx\b/i, code: "CX", name: "Cathay Pacific" },
  { pattern: /\bmalaysia(\s+airlines?)?\b|\bmh\b/i, code: "MH", name: "Malaysia Airlines" },
];

/** Extract preferred airline IATA codes in mention order (deduped). */
export function extractPreferredAirlines(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, code } of ALIASES) {
    if (pattern.test(text) && !found.includes(code)) found.push(code);
  }
  return found;
}

/** Human label for an IATA code; falls back to the code itself. */
export function airlineDisplayName(codeOrLabel: string): string {
  const raw = codeOrLabel.trim();
  if (!raw) return "Airline";
  const upper = raw.toUpperCase();
  const code = upper.slice(0, 2);
  if (/^[A-Z0-9]{2}$/.test(upper) || /^[A-Z0-9]{2}\b/.test(upper)) {
    const alias = ALIASES.find((a) => a.code === code);
    if (alias) return alias.name;
  }
  const byName = ALIASES.find((a) => upper.includes(a.name.toUpperCase()));
  if (byName) return byName.name;
  return raw;
}

export function airlineIataCode(codeOrLabel: string): string {
  const upper = codeOrLabel.trim().toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(upper)) return upper;
  const alias = ALIASES.find(
    (a) =>
      upper === a.code ||
      upper.startsWith(`${a.code} `) ||
      upper.includes(a.name.toUpperCase()),
  );
  return alias?.code || upper.slice(0, 2);
}

export function airlineMatchesPreference(
  airlineLabel: string,
  preferredCodes: string[],
): boolean {
  if (preferredCodes.length === 0) return true;
  const label = airlineLabel.toUpperCase();
  return preferredCodes.some((code) => {
    if (label === code || label.startsWith(`${code} `) || label.includes(` ${code}`)) {
      return true;
    }
    const alias = ALIASES.find((a) => a.code === code);
    if (alias && label.includes(alias.name.toUpperCase())) return true;
    // Loose: "QATAR" in "QATAR AIRWAYS"
    if (code === "QR" && label.includes("QATAR")) return true;
    if (code === "SV" && (label.includes("SAUDIA") || label.includes("SAUDI"))) return true;
    if (code === "EK" && label.includes("EMIRATES")) return true;
    if (code === "EY" && label.includes("ETIHAD")) return true;
    if (code === "PK" && (label.includes("PIA") || label.includes("PAKISTAN"))) return true;
    if (code === "TK" && label.includes("TURKISH")) return true;
    if (code === "SQ" && label.includes("SINGAPORE")) return true;
    if (code === "BA" && label.includes("BRITISH")) return true;
    if (code === "TG" && label.includes("THAI")) return true;
    if (code === "UL" && label.includes("SRILANKAN")) return true;
    if (code === "WY" && label.includes("OMAN")) return true;
    if (code === "CX" && label.includes("CATHAY")) return true;
    if (code === "MH" && label.includes("MALAYSIA")) return true;
    return false;
  });
}
