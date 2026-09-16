/**
 * Module 08 — Ava visa question detection + server grounding helpers.
 * Never invents visa facts client-side; only formats Module 08 API responses.
 */

const VISA_INTENT =
  /\b(visa|e-?visa|visa[-\s]?on[-\s]?arrival|transit\s+visa|embassy\s+visa|do i need (a )?visa|visa\s+required|visa\s+requirement)\b/i;

/** Common destination phrases → ISO2 (guidance lookup only; not a fee/rules table). */
const DESTINATION_HINTS: Record<string, string> = {
  uae: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  turkey: "TR",
  istanbul: "TR",
  "united kingdom": "GB",
  uk: "GB",
  london: "GB",
  "united states": "US",
  usa: "US",
  "saudi arabia": "SA",
  jeddah: "SA",
  riyadh: "SA",
  qatar: "QA",
  doha: "QA",
  thailand: "TH",
  bangkok: "TH",
  malaysia: "MY",
  singapore: "SG",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
  pakistan: "PK",
};

export function isVisaQuestion(message: string): boolean {
  return VISA_INTENT.test(String(message || ""));
}

export function extractDestinationIso2(message: string): string | null {
  const lower = String(message || "").toLowerCase();
  // Explicit ISO2 after "to " e.g. "to AE"
  const iso = lower.match(/\bto\s+([a-z]{2})\b/i);
  if (iso && /^[a-z]{2}$/i.test(iso[1])) {
    return iso[1].toUpperCase();
  }
  for (const [hint, code] of Object.entries(DESTINATION_HINTS)) {
    if (lower.includes(hint)) return code;
  }
  return null;
}

/** Latest user-stated nationality overrides saved profile when passed to /visa/assess. */
export function extractNationalityIso2(message: string): string | null {
  const text = String(message || "");
  const explicit =
    text.match(/\b(?:nationality|passport(?:\s+from)?|citizen(?:ship)?(?:\s+of)?)\s*[:=]?\s*([A-Za-z]{2})\b/i) ||
    text.match(/\bi(?:'m| am)\s+([A-Za-z]{2})\s+(?:national|passport)\b/i);
  if (explicit?.[1]) return explicit[1].toUpperCase();

  const lower = text.toLowerCase();
  const nationalityHints: Record<string, string> = {
    pakistani: "PK",
    pakistan: "PK",
    indian: "IN",
    "united states": "US",
    american: "US",
    british: "GB",
    "uk citizen": "GB",
    turkish: "TR",
    emirati: "AE",
    saudi: "SA",
    canadian: "CA",
    australian: "AU",
    german: "DE",
    french: "FR",
  };
  for (const [hint, code] of Object.entries(nationalityHints)) {
    if (lower.includes(hint)) return code;
  }
  return null;
}

export type VisaAssessmentPayload = {
  status?: string;
  isFact?: boolean;
  escalateRecommended?: boolean;
  avaSummary?: string;
  missingInputs?: string[];
  requirement?: {
    category?: string;
    dataStatus?: string;
    isFact?: boolean;
    confidenceNote?: string;
  } | null;
  confidenceNote?: string;
};

export function formatVisaGuidanceForPrompt(assessment: VisaAssessmentPayload | null): string | null {
  if (!assessment) return null;
  const escalate = Boolean(assessment.escalateRecommended);
  const lines = [
    "VISA INTELLIGENCE (Module 08 — attributed server data only):",
    assessment.avaSummary || assessment.confidenceNote || "",
    `isFact=${Boolean(assessment.isFact)}; escalateRecommended=${escalate}; dataStatus=${assessment.requirement?.dataStatus ?? assessment.status ?? "unknown"}`,
    "If not isFact: tell the traveller you cannot confirm requirements from attributed data and offer a human consultant. Never invent fees, processing times, exemptions, or approval odds.",
    escalate
      ? "Uncertain case: recommend human help and mention escalation trigger VISA_UNCERTAIN — do not invent eligibility."
      : null,
  ];
  return lines.filter(Boolean).join(" ");
}
