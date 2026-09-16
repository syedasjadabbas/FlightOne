/**
 * Module 05 — Pricing & Margin Engine. Single source of pricing truth
 * (module doc: "Module 03 must call it at every step — quote, reserve,
 * pay — rather than caching/reusing a price computed earlier in the flow").
 *
 * `priceOffer` never trusts a client-supplied sell price. Every amount flows
 * through lib/money.js (integer minor units + integer bps, never floats).
 *
 * Markup precedence (exactly one markup applied — never stacked):
 *   1. Optional Module 06 company markup (`companyMarkupBps`) when provided
 *   2. Highest-priority matching MarkupRule
 *   3. Product default (flight 9% / hotel 14%) else platform `default_markup_bps`
 *
 * After discounts, a configured `min_margin_bps` floor is enforced so margin
 * cannot go negative/invalid.
 *
 * Currency conversion is NOT performed here — if a caller asks for a different
 * display/settlement currency without a trusted rate, pricing fails closed.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import {
  addMinor,
  assertCurrencyCode,
  assertNonNegativeBps,
  assertNonNegativeMinorAmount,
  bpsOfMinor,
  capBps,
  subtractMinor,
} from "../../lib/money.js";
import {
  AGENT_DISCOUNT_TIER_CONFIG_KEYS,
  AGENT_DISCOUNT_TIER_DEFAULT_BPS,
  AGENT_DISCOUNT_TIER_ORDER,
  AGENT_DISCOUNT_TIER_PERMISSIONS,
  AGENT_DISCOUNT_UNAUTHORIZED_CODE,
} from "./pricing.constants.js";

/** Basis-points denominator: 10000 bps = 100%. */
const BPS_100_PERCENT = 10000;

const LOOKUP_CACHE_TTL_MS = 60_000;
let markupRulesCache = { at: 0, rows: null };
let pricingConfigCache = { at: 0, map: null };

async function getActiveMarkupRules() {
  const now = Date.now();
  if (markupRulesCache.rows && now - markupRulesCache.at < LOOKUP_CACHE_TTL_MS) {
    return markupRulesCache.rows;
  }
  const rows = await prisma.markupRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      routePattern: true,
      supplierCode: true,
      cabin: true,
      segment: true,
      markupBps: true,
      priority: true,
      validFrom: true,
      validTo: true,
    },
  });
  markupRulesCache = { at: now, rows };
  return rows;
}

async function getPricingConfigMap() {
  const now = Date.now();
  if (pricingConfigCache.map && now - pricingConfigCache.at < LOOKUP_CACHE_TTL_MS) {
    return pricingConfigCache.map;
  }
  const rows = await prisma.pricingConfig.findMany({ select: { key: true, valueInt: true } });
  const map = new Map(rows.map((r) => [r.key, r.valueInt]));
  pricingConfigCache = { at: now, map };
  return map;
}

/** Test/admin escape hatch — nothing in request handling calls this. */
export function invalidatePricingLookupCache() {
  markupRulesCache = { at: 0, rows: null };
  pricingConfigCache = { at: 0, map: null };
}

async function getConfigInt(key, { required = false, fallback = 0 } = {}) {
  const map = await getPricingConfigMap();
  if (map.has(key)) return map.get(key);
  if (required) {
    throw new AppError(500, `Pricing configuration missing required key "${key}"`);
  }
  return fallback;
}

/**
 * Platform default markup when no MarkupRule / company override matches.
 * FlightOne product defaults: flight 9%, hotel 14%.
 */
async function getDefaultMarkupBps(product) {
  const normalized = product ? String(product).trim().toUpperCase() : "";
  if (normalized === "FLIGHT") {
    const flightBps = await getConfigInt("flight_default_markup_bps");
    if (flightBps > 0) return flightBps;
  }
  if (normalized === "HOTEL") {
    const hotelBps = await getConfigInt("hotel_default_markup_bps");
    if (hotelBps > 0) return hotelBps;
  }
  if (normalized === "PACKAGE") {
    const packageBps = await getConfigInt("package_default_markup_bps");
    if (packageBps > 0) return packageBps;
  }
  return getConfigInt("default_markup_bps", { required: true });
}

/** `null`/undefined rule field = wildcard (matches anything). */
function matchesScalar(ruleValue, inputValue) {
  if (ruleValue == null) return true;
  if (inputValue == null) return false;
  return String(ruleValue).trim().toUpperCase() === String(inputValue).trim().toUpperCase();
}

/** `routePattern` supports a trailing `*` wildcard, e.g. "LHE-*". */
function matchesRoutePattern(pattern, route) {
  if (pattern == null) return true;
  if (route == null) return false;
  const p = pattern.trim().toUpperCase();
  const r = route.trim().toUpperCase();
  if (p.endsWith("*")) {
    return r.startsWith(p.slice(0, -1));
  }
  return p === r;
}

function isRuleCurrentlyValid(rule, now) {
  if (rule.validFrom && rule.validFrom > now) return false;
  if (rule.validTo && rule.validTo < now) return false;
  return true;
}

/**
 * Highest-priority active MarkupRule matching every supplied filter.
 * Rows are pre-sorted priority desc — first match wins (no stacking).
 */
async function findMatchingMarkupRule({ route, supplierCode, cabin, segment }) {
  const rules = await getActiveMarkupRules();
  const now = new Date();
  return (
    rules.find(
      (rule) =>
        isRuleCurrentlyValid(rule, now) &&
        matchesRoutePattern(rule.routePattern, route) &&
        matchesScalar(rule.supplierCode, supplierCode) &&
        matchesScalar(rule.cabin, cabin) &&
        matchesScalar(rule.segment, segment),
    ) ?? null
  );
}

function isPromoCurrentlyValid(promo, now) {
  if (!promo.isActive) return false;
  if (promo.validFrom && promo.validFrom > now) return false;
  if (promo.validTo && promo.validTo < now) return false;
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return false;
  return true;
}

function normalizePromoCode(code) {
  return code.trim().toUpperCase();
}

async function loadValidPromo(code) {
  if (!code) return null;
  const promo = await prisma.promoCode.findUnique({ where: { code: normalizePromoCode(code) } });
  if (!promo || !isPromoCurrentlyValid(promo, new Date())) {
    throw new AppError(400, "Promo code is invalid, expired, or exhausted");
  }
  return promo;
}

/**
 * Fail closed when a different currency is requested without a trusted FX rate.
 * Module 05 does not invent FX providers.
 */
function assertNoUnconfiguredFx({ currency, displayCurrency, settlementCurrency, fxRateBps }) {
  const targets = [displayCurrency, settlementCurrency].filter(Boolean);
  for (const target of targets) {
    assertCurrencyCode(target, "targetCurrency");
    if (target === currency) continue;
    if (fxRateBps == null) {
      throw new AppError(
        503,
        `Currency conversion unconfigured (${currency} → ${target})`,
      );
    }
    assertNonNegativeBps(fxRateBps, "fxRateBps");
    // Trusted rate present — still no conversion applied in Phase 1 math path;
    // callers must convert explicitly outside this engine. Fail closed for now.
    throw new AppError(
      503,
      `Currency conversion not applied by pricing engine (${currency} → ${target})`,
    );
  }
}

/**
 * Collect permission keys from Module 00 effective permissions or an internal Set.
 * @param {import("../../lib/permissions.service.js").EffectivePermissions | Set<string> | null | undefined} eff
 * @returns {Set<string>}
 */
function collectPermissionKeys(eff) {
  if (!eff) return new Set();
  if (eff instanceof Set) return eff;
  const keys = new Set(eff.global || []);
  for (const arr of Object.values(eff.byCompany || {})) {
    if (!Array.isArray(arr)) continue;
    for (const k of arr) keys.add(k);
  }
  return keys;
}

/**
 * Server-only: resolve the authenticated actor's max discretionary discount (bps)
 * from RBAC tier permissions + PricingConfig. Never trust a client-supplied value.
 *
 * @param {import("../../lib/permissions.service.js").EffectivePermissions | Set<string> | null | undefined} effectivePermissions
 * @returns {Promise<number>} 0 when the actor has no discount tier permission
 */
export async function resolveAgentDiscountMaxBps(effectivePermissions) {
  const keys = collectPermissionKeys(effectivePermissions);
  const hasWildcard = keys.has("*");

  let highestTier = null;
  for (const tier of AGENT_DISCOUNT_TIER_ORDER) {
    const perm = AGENT_DISCOUNT_TIER_PERMISSIONS[tier];
    if (hasWildcard || keys.has(perm)) {
      highestTier = tier;
    }
  }
  if (!highestTier) return 0;

  const configKey = AGENT_DISCOUNT_TIER_CONFIG_KEYS[highestTier];
  const fallback = AGENT_DISCOUNT_TIER_DEFAULT_BPS[highestTier];
  const maxBps = await getConfigInt(configKey, { fallback });
  assertNonNegativeBps(maxBps, configKey);
  return maxBps;
}

/**
 * Price a net supplier fare into a final customer-facing amount.
 */
export async function priceOffer({
  netMinor,
  currency,
  product,
  supplierCode,
  route,
  cabin,
  segment,
  promoCode,
  requestedDiscountBps,
  previousAmountMinor,
  /** Module 06 may pass negotiated company markup bps — takes precedence over MarkupRule. */
  companyMarkupBps,
  /**
   * Server-resolved agent discretionary authority (bps). When set (including 0),
   * a requested discretionary discount is attributed to an authenticated agent and
   * must not exceed this value — never accept this field from a client.
   * When omitted, discretionary discount uses the AI/system soft-cap + escalation path.
   */
  agentDiscountMaxBps,
  displayCurrency,
  settlementCurrency,
  fxRateBps,
} = {}) {
  assertNonNegativeMinorAmount(netMinor, "netMinor");
  if (netMinor <= 0) {
    throw new AppError(400, "netMinor must be a positive supplier cost");
  }
  assertCurrencyCode(currency);
  assertNoUnconfiguredFx({ currency, displayCurrency, settlementCurrency, fxRateBps });

  if (requestedDiscountBps !== undefined) {
    assertNonNegativeBps(requestedDiscountBps, "requestedDiscountBps");
  }
  if (previousAmountMinor !== undefined) {
    assertNonNegativeMinorAmount(previousAmountMinor, "previousAmountMinor");
  }
  if (companyMarkupBps !== undefined) {
    assertNonNegativeBps(companyMarkupBps, "companyMarkupBps");
  }
  if (agentDiscountMaxBps !== undefined) {
    assertNonNegativeBps(agentDiscountMaxBps, "agentDiscountMaxBps");
  }

  const appliedRules = [];

  // 1. Exactly one markup — company override XOR MarkupRule XOR product default.
  let markupBps;
  if (companyMarkupBps !== undefined) {
    markupBps = companyMarkupBps;
    appliedRules.push({
      type: "CORPORATE_MARKUP",
      markupBps,
      source: "module_06",
    });
  } else {
    const matchedRule = await findMatchingMarkupRule({
      route,
      supplierCode,
      cabin,
      segment,
    });
    if (matchedRule) {
      assertNonNegativeBps(matchedRule.markupBps, "markupRule.markupBps");
      markupBps = matchedRule.markupBps;
      appliedRules.push({
        type: "MARKUP_RULE",
        id: matchedRule.id,
        name: matchedRule.name,
        markupBps: matchedRule.markupBps,
        priority: matchedRule.priority,
      });
    } else {
      markupBps = await getDefaultMarkupBps(product);
      assertNonNegativeBps(markupBps, "defaultMarkupBps");
      appliedRules.push({
        type: "DEFAULT_MARKUP",
        markupBps,
        product: product ?? null,
      });
    }
  }

  const markupCount = appliedRules.filter((r) =>
    ["CORPORATE_MARKUP", "MARKUP_RULE", "DEFAULT_MARKUP"].includes(r.type),
  ).length;
  if (markupCount !== 1) {
    throw new AppError(500, "Pricing integrity error: expected exactly one markup");
  }

  const markupMinor = bpsOfMinor(netMinor, markupBps);
  const grossMinor = addMinor(netMinor, markupMinor);

  // 2. Promo discount.
  let promoBps = 0;
  if (promoCode) {
    const promo = await loadValidPromo(promoCode);
    promoBps = promo.discountBps;
    appliedRules.push({ type: "PROMO", code: promo.code, discountBps: promo.discountBps });
  }

  // 3. Discretionary discount (agent tier hard-limit, then AI/negotiation soft-cap).
  // Agent path: `agentDiscountMaxBps` is server-resolved from RBAC — exceeding it fails closed.
  // AI/system path (agentDiscountMaxBps omitted): soft-cap + Module 13 escalation flags.
  // Effective AI/negotiation cap = min(ai_discount_max_bps, negotiation_buffer_bps) when buffer > 0.
  let aiDiscountAllowed = true;
  let escalationRequired = false;
  let appliedRequestedBps = 0;
  if (requestedDiscountBps) {
    if (agentDiscountMaxBps !== undefined && requestedDiscountBps > agentDiscountMaxBps) {
      const err = new AppError(403, "Forbidden");
      err.code = AGENT_DISCOUNT_UNAUTHORIZED_CODE;
      throw err;
    }

    const maxDiscountBps = await getConfigInt("ai_discount_max_bps", { required: true });
    const negotiationBufferBps = await getConfigInt("negotiation_buffer_bps", { fallback: 0 });
    const effectiveCap =
      negotiationBufferBps > 0
        ? Math.min(maxDiscountBps, negotiationBufferBps)
        : maxDiscountBps;
    if (requestedDiscountBps > effectiveCap) {
      escalationRequired = true;
      aiDiscountAllowed = false;
      appliedRequestedBps = effectiveCap;
    } else {
      appliedRequestedBps = requestedDiscountBps;
    }
    appliedRules.push({
      type: "REQUESTED_DISCOUNT",
      requestedBps: requestedDiscountBps,
      appliedBps: appliedRequestedBps,
      capped: escalationRequired,
      aiDiscountMaxBps: maxDiscountBps,
      negotiationBufferBps: negotiationBufferBps > 0 ? negotiationBufferBps : null,
      effectiveCapBps: effectiveCap,
      // Audit only — do not expose full tier configuration maps to clients.
      ...(agentDiscountMaxBps !== undefined
        ? { agentDiscountMaxBps, agentAuthorityEnforced: true }
        : { agentAuthorityEnforced: false }),
    });
  }

  const totalDiscountBps = capBps(promoBps + appliedRequestedBps, BPS_100_PERCENT);
  let discountMinor = bpsOfMinor(grossMinor, totalDiscountBps);
  let amountMinor = subtractMinor(grossMinor, discountMinor);

  // 4. Minimum margin floor — prevents negative/invalid margins after discounts.
  const minMarginBps = await getConfigInt("min_margin_bps", { fallback: 0 });
  if (minMarginBps > 0) {
    assertNonNegativeBps(minMarginBps, "min_margin_bps");
    const minAmountMinor = addMinor(netMinor, bpsOfMinor(netMinor, minMarginBps));
    if (amountMinor < minAmountMinor) {
      appliedRules.push({
        type: "MIN_MARGIN_FLOOR",
        minMarginBps,
        raisedFromMinor: amountMinor,
        floorMinor: minAmountMinor,
      });
      amountMinor = minAmountMinor;
      // Recompute discount as whatever remains after floor (never invent negative discount).
      discountMinor = Math.max(0, subtractMinor(grossMinor, amountMinor));
    }
  }

  let marginMinorValue = subtractMinor(amountMinor, netMinor);
  if (marginMinorValue < 0) {
    throw new AppError(500, "Pricing integrity error: negative margin");
  }

  const result = {
    currency,
    netMinor,
    markupMinor,
    discountMinor,
    amountMinor,
    marginMinor: marginMinorValue,
    markupBps,
    appliedRules,
    aiDiscountAllowed,
    escalationRequired,
  };

  if (previousAmountMinor !== undefined) {
    result.priceChanged = previousAmountMinor !== amountMinor;
  }

  return result;
}

/**
 * Atomically increments a promo's usage counter — ticket issuance only.
 */
export async function redeemPromoCode(code) {
  if (!code) return;
  await prisma.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" + 1
    WHERE "code" = ${normalizePromoCode(code)}
      AND "isActive" = true
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
}

/**
 * Attach Module 05 sell price to a supplier search offer.
 * Preserves `amountMinor` as supplier net (snapshot integrity).
 * Adds `sellAmountMinor` + `pricing` audit — never double-marks up.
 */
export async function attachAuthoritativeSellPrice(offer) {
  if (!offer || !Number.isInteger(offer.amountMinor) || offer.amountMinor <= 0) {
    return offer;
  }
  const origin = offer.details?.origin;
  const destination = offer.details?.destination;
  const route =
    typeof origin === "string" && typeof destination === "string"
      ? `${origin}-${destination}`.toUpperCase()
      : undefined;
  const cabin = offer.details?.cabinClass || offer.details?.cabin || undefined;

  const priced = await priceOffer({
    netMinor: offer.amountMinor,
    currency: offer.currency,
    product: offer.product,
    supplierCode: offer.supplierCode,
    route,
    cabin,
  });

  return {
    ...offer,
    sellAmountMinor: priced.amountMinor,
    pricing: {
      currency: priced.currency,
      netMinor: priced.netMinor,
      markupMinor: priced.markupMinor,
      discountMinor: priced.discountMinor,
      marginMinor: priced.marginMinor,
      markupBps: priced.markupBps,
      amountMinor: priced.amountMinor,
      appliedRules: priced.appliedRules,
    },
  };
}

/** Price a batch of supplier offers for search responses. */
export async function attachAuthoritativeSellPrices(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return offers ?? [];
  return Promise.all(offers.map((o) => attachAuthoritativeSellPrice(o)));
}
