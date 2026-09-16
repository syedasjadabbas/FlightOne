/**
 * Module 08 — Visa data providers.
 *
 * Never invents visa rules, fees, processing times, or eligibility.
 * Default `catalog` reads ops-maintained VisaRequirement rows with attribution.
 * Explicit `VISA_PROVIDER=unconfigured` → DATA_UNAVAILABLE everywhere.
 * Optional `VISA_PROVIDER=http` + VISA_HTTP_URL for an external authority.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";

export const VISA_STALE_DEFAULT_DAYS = 180;

export function getVisaProviderName(env = process.env) {
  return (env.VISA_PROVIDER || "catalog").trim().toLowerCase();
}

export function getVisaStaleAfterDays(env = process.env) {
  const n = Number(env.VISA_STALE_AFTER_DAYS);
  if (!Number.isFinite(n) || n < 1) return VISA_STALE_DEFAULT_DAYS;
  return Math.min(Math.floor(n), 3650);
}

/**
 * @returns {{
 *   provider: string,
 *   configured: boolean,
 *   canLookup: boolean,
 *   sourceKind: string,
 *   staleAfterDays: number,
 *   reasons: string[],
 * }}
 */
export function getVisaDataCapability(env = process.env) {
  const provider = getVisaProviderName(env);
  const staleAfterDays = getVisaStaleAfterDays(env);

  if (provider === "unconfigured" || provider === "none") {
    return {
      provider: "unconfigured",
      configured: false,
      canLookup: false,
      sourceKind: "none",
      staleAfterDays,
      reasons: [
        "Visa data provider is unconfigured — set VISA_PROVIDER=catalog or VISA_PROVIDER=http with VISA_HTTP_URL",
      ],
    };
  }

  if (provider === "http") {
    const url = env.VISA_HTTP_URL?.trim();
    if (!url) {
      return {
        provider: "http_misconfigured",
        configured: false,
        canLookup: false,
        sourceKind: "http",
        staleAfterDays,
        reasons: ["VISA_HTTP_URL is required when VISA_PROVIDER=http"],
      };
    }
    return {
      provider: "http",
      configured: true,
      canLookup: true,
      sourceKind: "external_http",
      staleAfterDays,
      reasons: [],
    };
  }

  // catalog (default) — ops DB rows; not live Timatic/government unless seeded as such
  return {
    provider: "catalog",
    configured: true,
    canLookup: true,
    sourceKind: "ops_catalog",
    staleAfterDays,
    reasons: [],
  };
}

function classifyFreshness(lastVerifiedAt, staleAfterDays) {
  if (!lastVerifiedAt) return "UNKNOWN";
  const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "UNKNOWN";
  const staleMs = staleAfterDays * 24 * 60 * 60 * 1000;
  return ageMs > staleMs ? "STALE" : "VERIFIED";
}

/**
 * Normalize a catalog/http row into the Module 08 response contract.
 * `isFact` is true only when attributed + verified-fresh.
 */
export function toVisaRequirementAssessment(row, { nationalityCode, destinationCode, role = "destination" }) {
  const capability = getVisaDataCapability();
  if (!capability.canLookup) {
    return {
      nationalityCode,
      destinationCode,
      role,
      category: "UNKNOWN",
      dataStatus: "UNCONFIGURED",
      isFact: false,
      isGuidance: true,
      escalateRecommended: true,
      provider: capability.provider,
      sourceKind: capability.sourceKind,
      source: null,
      lastVerifiedAt: null,
      transitNotes: null,
      requiredDocuments: null,
      embassyInfo: null,
      processingDaysMin: null,
      processingDaysMax: null,
      confidenceNote:
        "Authoritative visa data is not configured. Do not invent requirements; escalate to a human consultant.",
    };
  }

  if (!row) {
    return {
      nationalityCode,
      destinationCode,
      role,
      category: "UNKNOWN",
      dataStatus: "DATA_UNAVAILABLE",
      isFact: false,
      isGuidance: true,
      escalateRecommended: true,
      provider: capability.provider,
      sourceKind: capability.sourceKind,
      source: null,
      lastVerifiedAt: null,
      transitNotes: null,
      requiredDocuments: null,
      embassyInfo: null,
      processingDaysMin: null,
      processingDaysMax: null,
      confidenceNote:
        "No attributed visa requirement is on file for this nationality × destination. Do not invent a category.",
    };
  }

  const freshness = classifyFreshness(row.lastVerifiedAt, capability.staleAfterDays);
  const hasAttribution = Boolean(row.source && row.lastVerifiedAt);
  const dataStatus =
    freshness === "STALE" ? "STALE" : hasAttribution ? "VERIFIED" : "UNKNOWN";
  const isFact = dataStatus === "VERIFIED";

  return {
    id: row.id,
    nationalityCode: row.nationalityCode,
    destinationCode: row.destinationCode,
    role,
    category: row.category,
    transitNotes: row.transitNotes ?? null,
    requiredDocuments: row.requiredDocuments ?? null,
    embassyInfo: row.embassyInfo ?? null,
    // Only surface processing estimates when attributed — never invent numbers.
    processingDaysMin: isFact || dataStatus === "STALE" ? row.processingDaysMin ?? null : null,
    processingDaysMax: isFact || dataStatus === "STALE" ? row.processingDaysMax ?? null : null,
    source: row.source ?? null,
    lastVerifiedAt: row.lastVerifiedAt ?? null,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    dataStatus,
    isFact,
    isGuidance: !isFact,
    escalateRecommended: !isFact || dataStatus === "STALE",
    provider: capability.provider,
    sourceKind: capability.sourceKind,
    confidenceNote: isFact
      ? `Attributed ops/catalog fact (source: ${row.source}; verified ${row.lastVerifiedAt}).`
      : dataStatus === "STALE"
        ? "Visa data is past the freshness window — treat as guidance only; re-verify or escalate."
        : "Visa row lacks full attribution — treat as guidance only; do not present as confirmed fact.",
  };
}

const REQUIREMENT_SELECT = {
  id: true,
  nationalityCode: true,
  destinationCode: true,
  category: true,
  transitNotes: true,
  requiredDocuments: true,
  embassyInfo: true,
  processingDaysMin: true,
  processingDaysMax: true,
  source: true,
  lastVerifiedAt: true,
  isActive: true,
  updatedAt: true,
};

async function catalogLookup(nationalityCode, destinationCode) {
  return prisma.visaRequirement.findFirst({
    where: { nationalityCode, destinationCode, isActive: true },
    select: REQUIREMENT_SELECT,
  });
}

async function httpLookup(nationalityCode, destinationCode, env = process.env) {
  const url = env.VISA_HTTP_URL?.trim();
  if (!url) {
    const err = new AppError(503, "Visa HTTP provider is not configured");
    err.code = "VISA_PROVIDER_UNCONFIGURED";
    throw err;
  }
  const timeoutMs = Number(env.VISA_HTTP_TIMEOUT_MS) || 12_000;
  const apiKey = env.VISA_HTTP_API_KEY?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = new URL(url);
    endpoint.searchParams.set("nationality", nationalityCode);
    endpoint.searchParams.set("destination", destinationCode);
    const headers = { accept: "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = new AppError(502, "Visa provider request failed");
      err.code = "VISA_PROVIDER_ERROR";
      throw err;
    }
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    // Map only fields the remote returns — never invent category.
    if (!body.category) return null;
    return {
      id: body.id ?? null,
      nationalityCode,
      destinationCode,
      category: body.category,
      transitNotes: body.transitNotes ?? null,
      requiredDocuments: body.requiredDocuments ?? null,
      embassyInfo: body.embassyInfo ?? null,
      processingDaysMin: body.processingDaysMin ?? null,
      processingDaysMax: body.processingDaysMax ?? null,
      source: body.source ?? `http:${endpoint.host}`,
      lastVerifiedAt: body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null,
      isActive: true,
      updatedAt: new Date(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one nationality×destination requirement through the active provider.
 * @returns {Promise<object|null>} raw row or null
 */
export async function fetchVisaRequirementRow(nationalityCode, destinationCode, env = process.env) {
  const cap = getVisaDataCapability(env);
  if (!cap.canLookup) return null;

  if (cap.provider === "http") {
    return httpLookup(nationalityCode, destinationCode, env);
  }
  return catalogLookup(nationalityCode, destinationCode);
}
