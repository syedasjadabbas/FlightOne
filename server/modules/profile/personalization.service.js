/**
 * Module 02 — Ava personalization bundle (no document numbers / no PII dumps).
 */
import prisma from "../../config/prisma.js";
import { getOrCreateProfile } from "./profile.service.js";
import { listTravelHistory } from "./history.service.js";

/**
 * Soft defaults + context for Module 01. Conversation intent always overrides.
 */
export async function getPersonalizationBundle(userId) {
  const profile = await getOrCreateProfile(userId);

  const [loyalty, companions, history] = await Promise.all([
    prisma.loyaltyMembership.findMany({
      where: { profileUserId: userId },
      select: { type: true, programCode: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.travellerCompanion.findMany({
      where: { ownerUserId: userId },
      select: { fullName: true, kind: true, relationship: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    listTravelHistory(userId, { limit: 10 }),
  ]);

  const loyaltyAirlineCodes = [
    ...new Set(
      loyalty
        .filter((m) => m.type === "AIRLINE")
        .map((m) => String(m.programCode || "").trim().toUpperCase())
        .filter((c) => c.length >= 2 && c.length <= 3),
    ),
  ];

  const hotelLoyaltyChains = [
    ...new Set(
      loyalty
        .filter((m) => m.type === "HOTEL")
        .map((m) => String(m.programCode || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  const preferredAirlines = Array.isArray(profile.preferredAirlines)
    ? profile.preferredAirlines
    : [];

  const patterns = history.patterns ?? {
    frequentRoutes: [],
    frequentAirlines: [],
    frequentCabins: [],
    productMix: [],
    recentTrips: [],
  };

  return {
    preferredAirlines,
    preferredCabin: profile.preferredCabin,
    maxLayoverMinutes: profile.maxLayoverMinutes,
    seatPref: profile.seatPref,
    mealPref: profile.mealPref,
    loyaltyAirlineCodes,
    hotelLoyaltyChains,
    companions: companions.map((c) => ({
      fullName: c.fullName,
      kind: c.kind,
      relationship: c.relationship,
    })),
    travelHistory: {
      totalBookings: history.stats?.totalBookings ?? 0,
      completedBookings: history.stats?.completedBookings ?? 0,
      recentProducts: (history.items ?? [])
        .slice(0, 5)
        .map((b) => b.product)
        .filter(Boolean),
      frequentRoutes: patterns.frequentRoutes ?? [],
      frequentAirlines: patterns.frequentAirlines ?? [],
      frequentCabins: patterns.frequentCabins ?? [],
      recentTrips: patterns.recentTrips ?? [],
    },
    completeness: profile.completeness ?? null,
  };
}
