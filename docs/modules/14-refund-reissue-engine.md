/**
 * Module 14 — Refund & Reissue Engine
 *
 * Fail-closed: never invent penalties, agency fees, timelines, or payment success.
 * Config: REFUND_AGENCY_FEE_BPS or PricingConfig key refund_agency_fee_bps (explicit 0 allowed).
 * Payment: Stripe refunds when configured; simulated only with ALLOW_SIMULATED_PAYMENT;
 * otherwise PENDING_MANUAL / REQUIRES_HUMAN.
 *
 * Customer UI: /refunds, /refunds/[id]
 * Ops UI: /ops/refunds (refunds:read|write)
 */
