/**
 * Module 09 — ancillary journey providers (weather, hotel check-in, transfer,
 * immigration). Never fabricate alerts. Default: unconfigured / fail-closed.
 *
 * Optional HTTP feeds:
 *   JOURNEY_WEATHER_PROVIDER=http + JOURNEY_WEATHER_HTTP_URL
 *   JOURNEY_HOTEL_STATUS_PROVIDER=http + JOURNEY_HOTEL_STATUS_HTTP_URL
 *   JOURNEY_TRANSFER_STATUS_PROVIDER=http + JOURNEY_TRANSFER_STATUS_HTTP_URL
 *   JOURNEY_IMMIGRATION_PROVIDER=http|knowledge + optional HTTP URL
 */
const STALE_DEFAULT_MS = 6 * 60 * 60 * 1000;

/** @type {Record<string, null | ((q: object) => Promise<object|null>)>} */
const testFetchers = {
  weather: null,
  hotel: null,
  transfer: null,
  immigration: null,
};

function httpCapability(providerEnvKey, urlEnvKey, env = process.env) {
  const provider = (env[providerEnvKey] || "unconfigured").trim().toLowerCase();
  const staleRaw = Number(env.JOURNEY_ANCILLARY_STALE_AFTER_MS);
  const staleAfterMs =
    Number.isFinite(staleRaw) && staleRaw >= 1000 ? Math.min(staleRaw, 7 * 24 * 60 * 60 * 1000) : STALE_DEFAULT_MS;

  if (provider === "unconfigured" || provider === "none") {
    return {
      provider: "unconfigured",
      configured: false,
      canPollLive: false,
      sourceKind: "none",
      staleAfterMs,
      reasons: [`${providerEnvKey} is unconfigured`],
    };
  }
  if (provider === "http") {
    const url = env[urlEnvKey]?.trim();
    if (!url) {
      return {
        provider: "http_misconfigured",
        configured: false,
        canPollLive: false,
        sourceKind: "http",
        staleAfterMs,
        reasons: [`${urlEnvKey} required when ${providerEnvKey}=http`],
      };
    }
    return {
      provider: "http",
      configured: true,
      canPollLive: true,
      sourceKind: "external_http",
      staleAfterMs,
      reasons: [],
    };
  }
  if (provider === "knowledge" && providerEnvKey.includes("IMMIGRATION")) {
    return {
      provider: "knowledge",
      configured: true,
      canPollLive: true,
      sourceKind: "knowledge_corpus",
      staleAfterMs,
      reasons: [],
    };
  }
  return {
    provider: "unknown",
    configured: false,
    canPollLive: false,
    sourceKind: "none",
    staleAfterMs,
    reasons: [`Unknown ${providerEnvKey}=${provider}`],
  };
}

export function getWeatherCapability(env = process.env) {
  return httpCapability("JOURNEY_WEATHER_PROVIDER", "JOURNEY_WEATHER_HTTP_URL", env);
}

export function getHotelStatusCapability(env = process.env) {
  return httpCapability("JOURNEY_HOTEL_STATUS_PROVIDER", "JOURNEY_HOTEL_STATUS_HTTP_URL", env);
}

export function getTransferStatusCapability(env = process.env) {
  return httpCapability(
    "JOURNEY_TRANSFER_STATUS_PROVIDER",
    "JOURNEY_TRANSFER_STATUS_HTTP_URL",
    env,
  );
}

export function getImmigrationCapability(env = process.env) {
  const provider = (env.JOURNEY_IMMIGRATION_PROVIDER || "unconfigured").trim().toLowerCase();
  if (provider === "knowledge") {
    return httpCapability("JOURNEY_IMMIGRATION_PROVIDER", "JOURNEY_IMMIGRATION_HTTP_URL", {
      ...env,
      JOURNEY_IMMIGRATION_PROVIDER: "knowledge",
    });
  }
  return httpCapability("JOURNEY_IMMIGRATION_PROVIDER", "JOURNEY_IMMIGRATION_HTTP_URL", env);
}

export function getAncillaryCapabilities(env = process.env) {
  return {
    weather: getWeatherCapability(env),
    hotel: getHotelStatusCapability(env),
    transfer: getTransferStatusCapability(env),
    immigration: getImmigrationCapability(env),
  };
}

function classifyFreshness(observedAtIso, staleAfterMs) {
  if (!observedAtIso) return "UNKNOWN";
  const age = Date.now() - new Date(observedAtIso).getTime();
  if (!Number.isFinite(age) || age < 0) return "UNKNOWN";
  return age > staleAfterMs ? "STALE" : "VERIFIED";
}

function statusFromFreshness(freshness, { snapshot = null, kind = "ancillary" } = {}) {
  if (freshness === "VERIFIED") {
    return { dataStatus: "VERIFIED", isFact: true, snapshot, reason: null };
  }
  if (freshness === "STALE") {
    return {
      dataStatus: "STALE",
      isFact: false,
      snapshot,
      reason: `${kind} observation is stale`,
    };
  }
  return {
    dataStatus: "DATA_UNAVAILABLE",
    isFact: false,
    snapshot: null,
    reason: `${kind} provider omitted a valid observedAt — not treated as live fact`,
  };
}

function parseObservedAt(...candidates) {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

async function httpGetJson(url, params, env) {
  const timeoutMs = Number(env.JOURNEY_ANCILLARY_HTTP_TIMEOUT_MS) || 12_000;
  const apiKey =
    env.JOURNEY_ANCILLARY_HTTP_API_KEY?.trim() ||
    env.JOURNEY_STATUS_HTTP_API_KEY?.trim();
  const endpoint = new URL(url);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== "") endpoint.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: "empty" };
    if (!res.ok) return { kind: "error", reason: `HTTP ${res.status}` };
    const body = await res.json();
    const raw = body?.data && typeof body.data === "object" ? body.data : body;
    if (!raw || typeof raw !== "object") return { kind: "empty" };
    return { kind: "ok", raw };
  } catch (e) {
    return {
      kind: "error",
      reason: e?.name === "AbortError" ? "timeout" : e?.message || "request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(dataStatus, reason) {
  return { dataStatus, isFact: false, snapshot: null, reason };
}

async function resolveViaHttpOrTest({ kind, capability, query, urlEnv, normalize, env }) {
  if (typeof testFetchers[kind] === "function" && env.NODE_ENV === "test") {
    try {
      const raw = await testFetchers[kind](query);
      if (!raw) return unavailable("DATA_UNAVAILABLE", `Test ${kind} fetcher returned empty`);
      const snapshot = normalize(raw, query);
      const freshness = classifyFreshness(snapshot.observedAt, capability.staleAfterMs);
      return statusFromFreshness(freshness, { snapshot, kind });
    } catch (e) {
      return unavailable("PROVIDER_ERROR", e?.message || `${kind} test fetcher failed`);
    }
  }

  if (!capability.canPollLive) {
    return unavailable(
      capability.provider === "unconfigured" ? "UNCONFIGURED" : "DATA_UNAVAILABLE",
      capability.reasons[0] || `${kind} unavailable`,
    );
  }

  if (capability.provider !== "http") {
    return unavailable("DATA_UNAVAILABLE", `${kind} provider ${capability.provider} has no HTTP path here`);
  }

  const url = env[urlEnv]?.trim();
  const got = await httpGetJson(url, query, env);
  if (got.kind === "empty") return unavailable("DATA_UNAVAILABLE", `No ${kind} data for this journey`);
  if (got.kind === "error") return unavailable("PROVIDER_ERROR", got.reason);
  const snapshot = normalize(got.raw, query);
  const freshness = classifyFreshness(snapshot.observedAt, capability.staleAfterMs);
  return statusFromFreshness(freshness, { snapshot, kind });
}

function normalizeWeather(raw) {
  const severity =
    typeof raw.severity === "string"
      ? raw.severity.toUpperCase()
      : Number.isInteger(raw.severity)
        ? String(raw.severity)
        : "UNKNOWN";
  return {
    airportCode: raw.airportCode || raw.airport || null,
    alertId: raw.alertId || raw.id || null,
    title: typeof raw.title === "string" ? raw.title : null,
    summary: typeof raw.summary === "string" ? raw.summary : typeof raw.body === "string" ? raw.body : null,
    severity,
    observedAt: parseObservedAt(raw.observedAt),
    source: raw.source || null,
  };
}

function normalizeHotel(raw) {
  const status = typeof raw.status === "string" ? raw.status.toUpperCase() : "UNKNOWN";
  return {
    status,
    checkInDate: raw.checkInDate || null,
    confirmationRef: raw.confirmationRef || null,
    observedAt: parseObservedAt(raw.observedAt),
    source: raw.source || null,
    note: typeof raw.note === "string" ? raw.note : null,
  };
}

function normalizeTransfer(raw) {
  const status = typeof raw.status === "string" ? raw.status.toUpperCase() : "UNKNOWN";
  return {
    status,
    pickupAt: raw.pickupAt || null,
    transferRef: raw.transferRef || null,
    observedAt: parseObservedAt(raw.observedAt),
    source: raw.source || null,
    note: typeof raw.note === "string" ? raw.note : null,
  };
}

function normalizeImmigration(raw) {
  return {
    advisoryId: raw.advisoryId || raw.id || null,
    destinationCountry: raw.destinationCountry || null,
    title: typeof raw.title === "string" ? raw.title : null,
    summary: typeof raw.summary === "string" ? raw.summary : typeof raw.content === "string" ? raw.content : null,
    observedAt: parseObservedAt(raw.observedAt, raw.lastVerifiedAt),
    source: raw.source || null,
    lastVerifiedAt: raw.lastVerifiedAt || raw.observedAt || null,
  };
}

export async function fetchWeatherDisruption(query = {}, env = process.env) {
  const capability = getWeatherCapability(env);
  const airports = []
    .concat(query.origin || [], query.destination || [], query.airportCodes || [])
    .map((c) => String(c).toUpperCase())
    .filter(Boolean);
  if (!airports.length) {
    return unavailable("INCOMPLETE_INPUTS", "Airport codes required for weather lookup");
  }
  return resolveViaHttpOrTest({
    kind: "weather",
    capability,
    query: { airports: airports.join(","), flightNumber: query.flightNumber || "" },
    urlEnv: "JOURNEY_WEATHER_HTTP_URL",
    normalize: (raw) => normalizeWeather({ ...raw, airportCode: raw.airportCode || airports[0] }),
    env,
  });
}

export async function fetchHotelCheckInStatus(query = {}, env = process.env) {
  const capability = getHotelStatusCapability(env);
  if (!query.checkInDate && !query.confirmationRef && !query.bookingId) {
    return unavailable("INCOMPLETE_INPUTS", "Hotel check-in lookup needs checkInDate or confirmationRef");
  }
  return resolveViaHttpOrTest({
    kind: "hotel",
    capability,
    query: {
      bookingId: query.bookingId || "",
      checkInDate: query.checkInDate || "",
      confirmationRef: query.confirmationRef || "",
    },
    urlEnv: "JOURNEY_HOTEL_STATUS_HTTP_URL",
    normalize: normalizeHotel,
    env,
  });
}

export async function fetchTransferStatus(query = {}, env = process.env) {
  const capability = getTransferStatusCapability(env);
  if (!query.transferRef && !query.pickupAt && !query.bookingId) {
    return unavailable("INCOMPLETE_INPUTS", "Transfer lookup needs transferRef or pickupAt");
  }
  return resolveViaHttpOrTest({
    kind: "transfer",
    capability,
    query: {
      bookingId: query.bookingId || "",
      transferRef: query.transferRef || "",
      pickupAt: query.pickupAt || "",
    },
    urlEnv: "JOURNEY_TRANSFER_STATUS_HTTP_URL",
    normalize: normalizeTransfer,
    env,
  });
}

export async function fetchImmigrationAdvisory(query = {}, env = process.env) {
  const capability = getImmigrationCapability(env);
  const destination = query.destinationCountry
    ? String(query.destinationCountry).toUpperCase()
    : null;
  if (!destination || destination.length !== 2) {
    return unavailable("INCOMPLETE_INPUTS", "destinationCountry (ISO2) required for immigration advisory");
  }

  if (typeof testFetchers.immigration === "function" && env.NODE_ENV === "test") {
    try {
      const raw = await testFetchers.immigration(query);
      if (!raw) return unavailable("DATA_UNAVAILABLE", "Test immigration fetcher returned empty");
      const snapshot = normalizeImmigration(raw);
      const freshness = classifyFreshness(snapshot.observedAt, capability.staleAfterMs);
      return statusFromFreshness(freshness, { snapshot, kind: "immigration" });
    } catch (e) {
      return unavailable("PROVIDER_ERROR", e?.message || "immigration test fetcher failed");
    }
  }

  if (!capability.canPollLive) {
    return unavailable(
      capability.provider === "unconfigured" ? "UNCONFIGURED" : "DATA_UNAVAILABLE",
      capability.reasons[0] || "Immigration advisories unavailable",
    );
  }

  if (capability.provider === "knowledge") {
    try {
      const { retrieveKnowledge } = await import("../knowledge/knowledge.service.js");
      const result = await retrieveKnowledge({
        query: `immigration advisory entry exit ${destination} ${query.nationality || ""}`.trim(),
        limit: 3,
      });
      if (!result?.hits?.length || result.coverage === "none") {
        return unavailable("DATA_UNAVAILABLE", "No attributed immigration advisory in knowledge corpus");
      }
      const hit = result.hits[0];
      const lastVerifiedAt = hit.lastVerifiedAt
        ? new Date(hit.lastVerifiedAt).toISOString()
        : null;
      const freshness = classifyFreshness(lastVerifiedAt || new Date(0).toISOString(), capability.staleAfterMs);
      // Without lastVerifiedAt, never treat as fact.
      if (!lastVerifiedAt) {
        return {
          dataStatus: "DATA_UNAVAILABLE",
          isFact: false,
          snapshot: null,
          reason: "Knowledge hit lacks lastVerifiedAt — not treated as verified advisory",
        };
      }
      const snapshot = normalizeImmigration({
        advisoryId: hit.chunkId,
        destinationCountry: destination,
        title: hit.title,
        summary: hit.content?.slice(0, 500),
        observedAt: lastVerifiedAt,
        lastVerifiedAt,
        source: `knowledge:${hit.documentId}`,
      });
      return statusFromFreshness(freshness, {
        snapshot,
        kind: "immigration",
      });
    } catch (e) {
      return unavailable("PROVIDER_ERROR", e?.message || "knowledge retrieve failed");
    }
  }

  return resolveViaHttpOrTest({
    kind: "immigration",
    capability,
    query: {
      destinationCountry: destination,
      nationality: query.nationality || "",
    },
    urlEnv: "JOURNEY_IMMIGRATION_HTTP_URL",
    normalize: (raw) =>
      normalizeImmigration({ ...raw, destinationCountry: raw.destinationCountry || destination }),
    env,
  });
}

export function setAncillaryFetcherForTests(kind, fn) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setAncillaryFetcherForTests only allowed when NODE_ENV=test");
  }
  if (!(kind in testFetchers)) throw new Error(`Unknown ancillary kind ${kind}`);
  testFetchers[kind] = typeof fn === "function" ? fn : null;
}

export function resetAncillaryFetchersForTests() {
  for (const k of Object.keys(testFetchers)) testFetchers[k] = null;
}
