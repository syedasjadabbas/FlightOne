/**
 * Module 05 — Pricing domain constants.
 *
 * Agent discount permission tiers reuse Module 00 `resource:action` keys.
 * Exact tier percentages are not specified in the PRD; defaults below are the
 * smallest configurable ceilings and may be overridden via PricingConfig.
 */

/** Permission keys — highest matching tier wins. */
export const AGENT_DISCOUNT_TIER_PERMISSIONS = Object.freeze({
  JUNIOR: "pricing:discount:junior",
  STANDARD: "pricing:discount:standard",
  SENIOR: "pricing:discount:senior",
});

/** Lowest → highest authority (used when resolving max BPS). */
export const AGENT_DISCOUNT_TIER_ORDER = Object.freeze(["JUNIOR", "STANDARD", "SENIOR"]);

/**
 * Default max discretionary discount (bps) per tier.
 * Still subject to `ai_discount_max_bps` + `negotiation_buffer_bps` after the agent check.
 */
export const AGENT_DISCOUNT_TIER_DEFAULT_BPS = Object.freeze({
  JUNIOR: 100,
  STANDARD: 200,
  SENIOR: 300,
});

/** PricingConfig keys for per-tier overrides. */
export const AGENT_DISCOUNT_TIER_CONFIG_KEYS = Object.freeze({
  JUNIOR: "agent_discount_junior_bps",
  STANDARD: "agent_discount_standard_bps",
  SENIOR: "agent_discount_senior_bps",
});

export const AGENT_DISCOUNT_UNAUTHORIZED_CODE = "AGENT_DISCOUNT_UNAUTHORIZED";
