/**
 * Module 05 — authoritative pricing regression tests.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();

const { default: prisma } = await import("../../config/prisma.js");
const pricingService = await import("./pricing.service.js");
const {
  AGENT_DISCOUNT_TIER_PERMISSIONS,
  AGENT_DISCOUNT_UNAUTHORIZED_CODE,
  AGENT_DISCOUNT_TIER_DEFAULT_BPS,
} = await import("./pricing.constants.js");

async function ensureConfig() {
  for (const [key, valueInt] of [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
    ["hotel_default_markup_bps", 1400],
    ["min_margin_bps", 400],
    ["ai_discount_max_bps", 500],
    ["negotiation_buffer_bps", 300],
  ]) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  pricingService.invalidatePricingLookupCache();
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await ensureConfig();
});

beforeEach(async () => {
  await ensureConfig();
});

after(async () => {
  await prisma.$disconnect();
});

describe("pricing.service — product defaults", () => {
  it("uses 9% (900 bps) flight default when no MarkupRule matches", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      supplierCode: "GALILEO",
      route: "ISB-JED",
      cabin: "ECONOMY",
    });

    assert.equal(priced.amountMinor, Math.round(10_000 * 1.09));
    assert.equal(priced.markupMinor, priced.amountMinor - priced.netMinor);
    assert.equal(priced.markupBps, 900);
    assert.equal(priced.appliedRules[0].type, "DEFAULT_MARKUP");
    assert.equal(priced.appliedRules[0].markupBps, 900);
  });

  it("uses 14% (1400 bps) hotel default when no MarkupRule matches", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "HOTEL",
      supplierCode: "RATEHAWK",
    });

    assert.equal(priced.amountMinor, Math.round(10_000 * 1.14));
    assert.equal(priced.appliedRules[0].type, "DEFAULT_MARKUP");
    assert.equal(priced.appliedRules[0].markupBps, 1400);
  });

  it("keeps flight and hotel product defaults separate", async () => {
    const flight = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
    });
    const hotel = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "HOTEL",
    });
    assert.equal(flight.markupBps, 900);
    assert.equal(hotel.markupBps, 1400);
    assert.notEqual(flight.amountMinor, hotel.amountMinor);
  });
});

describe("pricing.service — dynamic rules & precedence", () => {
  it("applies route MarkupRule override ahead of the flight default", async () => {
    // Isolated fixture — must not depend on retired seed demo "Default LHE route markup (sample)".
    const name = `test-route-override-${Date.now()}`;
    const rule = await prisma.markupRule.create({
      data: {
        name,
        routePattern: "LHE-*",
        markupBps: 1250,
        priority: 10,
        isActive: true,
      },
    });
    pricingService.invalidatePricingLookupCache();
    try {
      const priced = await pricingService.priceOffer({
        netMinor: 10_000,
        currency: "USD",
        product: "FLIGHT",
        route: "LHE-DXB",
        cabin: "ECONOMY",
      });

      assert.equal(priced.amountMinor, Math.round(10_000 * 1.125));
      assert.equal(priced.appliedRules[0].type, "MARKUP_RULE");
      assert.equal(priced.appliedRules[0].markupBps, 1250);
    } finally {
      await prisma.markupRule.delete({ where: { id: rule.id } }).catch(() => {});
      pricingService.invalidatePricingLookupCache();
    }
  });

  it("applies exactly one markup (no double markup)", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "LHE-DXB",
    });
    const markups = priced.appliedRules.filter((r) =>
      ["CORPORATE_MARKUP", "MARKUP_RULE", "DEFAULT_MARKUP"].includes(r.type),
    );
    assert.equal(markups.length, 1);
  });

  it("companyMarkupBps (Module 06) outranks MarkupRule", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "LHE-DXB",
      companyMarkupBps: 700,
    });
    assert.equal(priced.markupBps, 700);
    assert.equal(priced.amountMinor, Math.round(10_000 * 1.07));
    assert.equal(priced.appliedRules[0].type, "CORPORATE_MARKUP");
    assert.equal(
      priced.appliedRules.some((r) => r.type === "MARKUP_RULE"),
      false,
    );
  });
});

describe("pricing.service — min margin & integrity", () => {
  it("enforces minimum margin floor when discounts would breach it", async () => {
    // Create a temporary promo that would wipe most of the margin.
    const code = `MINMARG${Date.now().toString(36).toUpperCase()}`;
    await prisma.promoCode.create({
      data: {
        code,
        discountBps: 8000, // 80% off gross — would go below 4% margin
        isActive: true,
      },
    });
    try {
      const priced = await pricingService.priceOffer({
        netMinor: 10_000,
        currency: "USD",
        product: "FLIGHT",
        route: "ISB-JED",
        promoCode: code,
      });
      assert.ok(priced.marginMinor >= Math.round(10_000 * 0.04));
      assert.ok(priced.appliedRules.some((r) => r.type === "MIN_MARGIN_FLOOR"));
      assert.ok(priced.marginMinor >= 0);
    } finally {
      await prisma.promoCode.delete({ where: { code } }).catch(() => {});
    }
  });

  it("rejects missing/zero supplier cost", async () => {
    await assert.rejects(
      () =>
        pricingService.priceOffer({
          netMinor: 0,
          currency: "USD",
          product: "FLIGHT",
        }),
      /positive supplier cost|must not be negative|netMinor/i,
    );
  });

  it("fails closed on currency conversion without trusted FX", async () => {
    await assert.rejects(
      () =>
        pricingService.priceOffer({
          netMinor: 10_000,
          currency: "USD",
          product: "FLIGHT",
          displayCurrency: "PKR",
        }),
      /Currency conversion unconfigured/i,
    );
  });

  it("preserves supplier currency on the priced result", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "EUR",
      product: "FLIGHT",
      route: "ISB-JED",
    });
    assert.equal(priced.currency, "EUR");
    assert.equal(priced.netMinor, 10_000);
  });

  it("is deterministic for identical inputs", async () => {
    const input = {
      netMinor: 12_345,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      cabin: "ECONOMY",
    };
    const a = await pricingService.priceOffer(input);
    const b = await pricingService.priceOffer(input);
    assert.deepEqual(
      {
        amountMinor: a.amountMinor,
        markupMinor: a.markupMinor,
        marginMinor: a.marginMinor,
        markupBps: a.markupBps,
      },
      {
        amountMinor: b.amountMinor,
        markupMinor: b.markupMinor,
        marginMinor: b.marginMinor,
        markupBps: b.markupBps,
      },
    );
  });

  it("reports priceChanged when previousAmountMinor differs (supplier/reprice)", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      previousAmountMinor: 999,
    });
    assert.equal(priced.priceChanged, true);
  });

  it("records auditable appliedRules explaining the final price", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
    });
    assert.ok(Array.isArray(priced.appliedRules));
    assert.ok(priced.appliedRules.length >= 1);
    assert.equal(typeof priced.markupBps, "number");
    assert.equal(typeof priced.marginMinor, "number");
  });
});

describe("pricing.service — negotiation buffer", () => {
  it("caps requested discount to min(ai_discount_max, negotiation_buffer)", async () => {
    // Buffer 300 < ai max 500 → effective cap 300.
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 400,
    });
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.ok(disc);
    assert.equal(disc.effectiveCapBps, 300);
    assert.equal(disc.appliedBps, 300);
    assert.equal(disc.capped, true);
    assert.equal(priced.escalationRequired, true);
    assert.equal(priced.aiDiscountAllowed, false);
    assert.ok(priced.marginMinor >= Math.round(10_000 * 0.04));
  });

  it("applies requested discount fully when within negotiation buffer", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 200,
    });
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.ok(disc);
    assert.equal(disc.appliedBps, 200);
    assert.equal(disc.capped, false);
    assert.equal(priced.escalationRequired, false);
    assert.equal(priced.aiDiscountAllowed, true);
  });
});

describe("pricing.service — search sell attachment", () => {
  it("exposes sellAmountMinor without mutating supplier net amountMinor", async () => {
    const offer = {
      amountMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      supplierCode: "GALILEO",
      details: { origin: "ISB", destination: "JED", cabinClass: "ECONOMY" },
    };
    const pricedOffer = await pricingService.attachAuthoritativeSellPrice(offer);
    assert.equal(pricedOffer.amountMinor, 10_000);
    assert.equal(pricedOffer.sellAmountMinor, Math.round(10_000 * 1.09));
    assert.equal(pricedOffer.pricing.netMinor, 10_000);
    assert.equal(pricedOffer.pricing.amountMinor, pricedOffer.sellAmountMinor);
    assert.notEqual(pricedOffer.sellAmountMinor, pricedOffer.amountMinor);
  });
});

describe("pricing.service — agent discount permission tiers", () => {
  beforeEach(async () => {
    for (const [key, valueInt] of [
      ["agent_discount_junior_bps", AGENT_DISCOUNT_TIER_DEFAULT_BPS.JUNIOR],
      ["agent_discount_standard_bps", AGENT_DISCOUNT_TIER_DEFAULT_BPS.STANDARD],
      ["agent_discount_senior_bps", AGENT_DISCOUNT_TIER_DEFAULT_BPS.SENIOR],
    ]) {
      await prisma.pricingConfig.upsert({
        where: { key },
        update: { valueInt },
        create: { key, valueInt },
      });
    }
    pricingService.invalidatePricingLookupCache();
  });

  it("agent with no discount authority cannot apply a discretionary discount", async () => {
    assert.equal(await pricingService.resolveAgentDiscountMaxBps({ global: [], byCompany: {} }), 0);
    await assert.rejects(
      () =>
        pricingService.priceOffer({
          netMinor: 10_000,
          currency: "USD",
          product: "FLIGHT",
          route: "ISB-JED",
          requestedDiscountBps: 100,
          agentDiscountMaxBps: 0,
        }),
      (err) =>
        err.statusCode === 403 &&
        err.code === AGENT_DISCOUNT_UNAUTHORIZED_CODE &&
        err.message === "Forbidden",
    );
  });

  it("agent with a configured tier can apply a discount within its limit", async () => {
    const max = await pricingService.resolveAgentDiscountMaxBps({
      global: [AGENT_DISCOUNT_TIER_PERMISSIONS.STANDARD],
      byCompany: {},
    });
    assert.equal(max, 200);
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 150,
      agentDiscountMaxBps: max,
    });
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.equal(disc.appliedBps, 150);
    assert.equal(disc.agentDiscountMaxBps, 200);
    assert.equal(disc.agentAuthorityEnforced, true);
    assert.equal(priced.escalationRequired, false);
  });

  it("agent cannot exceed its tier", async () => {
    await assert.rejects(
      () =>
        pricingService.priceOffer({
          netMinor: 10_000,
          currency: "USD",
          product: "FLIGHT",
          route: "ISB-JED",
          requestedDiscountBps: 250,
          agentDiscountMaxBps: 200,
        }),
      (err) => err.statusCode === 403 && err.code === AGENT_DISCOUNT_UNAUTHORIZED_CODE,
    );
  });

  it("client-supplied discount authority cannot bypass the server limit", async () => {
    // Server resolves junior (100); a forged higher authority must not be used —
    // callers must pass resolveAgentDiscountMaxBps(...), never a client claim.
    const serverMax = await pricingService.resolveAgentDiscountMaxBps({
      global: [AGENT_DISCOUNT_TIER_PERMISSIONS.JUNIOR],
      byCompany: {},
    });
    assert.equal(serverMax, 100);
    await assert.rejects(
      () =>
        pricingService.priceOffer({
          netMinor: 10_000,
          currency: "USD",
          product: "FLIGHT",
          route: "ISB-JED",
          requestedDiscountBps: 200,
          // Correct server authority (not a forged 500).
          agentDiscountMaxBps: serverMax,
        }),
      (err) => err.statusCode === 403 && err.code === AGENT_DISCOUNT_UNAUTHORIZED_CODE,
    );
  });

  it("higher tier receives its configured higher limit", async () => {
    const junior = await pricingService.resolveAgentDiscountMaxBps({
      global: [AGENT_DISCOUNT_TIER_PERMISSIONS.JUNIOR],
      byCompany: {},
    });
    const senior = await pricingService.resolveAgentDiscountMaxBps({
      global: [AGENT_DISCOUNT_TIER_PERMISSIONS.SENIOR],
      byCompany: {},
    });
    assert.equal(junior, 100);
    assert.equal(senior, 300);
    assert.ok(senior > junior);

    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 300,
      agentDiscountMaxBps: senior,
    });
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    // 300 equals negotiation buffer → applied fully, no escalation.
    assert.equal(disc.appliedBps, 300);
    assert.equal(priced.escalationRequired, false);
  });

  it("existing AI discount ceiling remains enforced under agent authority", async () => {
    // Senior authority 300; request above negotiation/AI effective cap (300) soft-caps + escalates.
    // Raise agent config above platform cap to prove AI/negotiation still binds.
    await prisma.pricingConfig.upsert({
      where: { key: "agent_discount_senior_bps" },
      update: { valueInt: 500 },
      create: { key: "agent_discount_senior_bps", valueInt: 500 },
    });
    pricingService.invalidatePricingLookupCache();
    const senior = await pricingService.resolveAgentDiscountMaxBps({
      global: [AGENT_DISCOUNT_TIER_PERMISSIONS.SENIOR],
      byCompany: {},
    });
    assert.equal(senior, 500);
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 400,
      agentDiscountMaxBps: senior,
    });
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.equal(disc.effectiveCapBps, 300);
    assert.equal(disc.appliedBps, 300);
    assert.equal(priced.escalationRequired, true);
    assert.equal(priced.aiDiscountAllowed, false);
  });

  it("negotiation buffer and min-margin rules remain enforced with agent discount", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      requestedDiscountBps: 200,
      agentDiscountMaxBps: 200,
    });
    assert.ok(priced.marginMinor >= Math.round(10_000 * 0.04));
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.equal(disc.effectiveCapBps, 300);
    assert.equal(disc.appliedBps, 200);
  });

  it("corporate markup still takes precedence with agent discount authority", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "LHE-DXB",
      companyMarkupBps: 700,
      requestedDiscountBps: 100,
      agentDiscountMaxBps: 200,
    });
    assert.equal(priced.markupBps, 700);
    assert.equal(priced.appliedRules[0].type, "CORPORATE_MARKUP");
    const disc = priced.appliedRules.find((r) => r.type === "REQUESTED_DISCOUNT");
    assert.equal(disc.appliedBps, 100);
  });

  it("9% default markup is unchanged when agent discount is not requested", async () => {
    const priced = await pricingService.priceOffer({
      netMinor: 10_000,
      currency: "USD",
      product: "FLIGHT",
      route: "ISB-JED",
      agentDiscountMaxBps: 0,
    });
    assert.equal(priced.amountMinor, Math.round(10_000 * 1.09));
    assert.equal(priced.markupBps, 900);
  });

  it("wildcard internal authority resolves to senior tier max", async () => {
    const max = await pricingService.resolveAgentDiscountMaxBps(new Set(["*"]));
    assert.equal(max, AGENT_DISCOUNT_TIER_DEFAULT_BPS.SENIOR);
  });
});
