import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";

const PROFILE_SELECT = {
  userId: true,
  displayName: true,
  phone: true,
  nationality: true,
  seatPref: true,
  mealPref: true,
  preferredAirlines: true,
  preferredCabin: true,
  maxLayoverMinutes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

function defaultDisplayName(user) {
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Traveller";
}

/**
 * Profile completeness for hands-free booking readiness (PRD Module 02).
 * Computed — not persisted — so it stays accurate as related rows change.
 */
export function computeProfileCompleteness(profile, counts = {}) {
  const missing = [];
  if (!profile?.displayName?.trim()) missing.push("displayName");
  if (!profile?.phone) missing.push("phone");
  if (!profile?.seatPref) missing.push("seatPref");
  if (!profile?.mealPref) missing.push("mealPref");
  if (
    !Array.isArray(profile?.preferredAirlines) ||
    profile.preferredAirlines.length === 0
  ) {
    missing.push("preferredAirlines");
  }
  if (!counts.hasPassport) missing.push("passport");
  if (!counts.hasEmergencyContact) missing.push("emergencyContact");

  const required = [
    "displayName",
    "phone",
    "seatPref",
    "mealPref",
    "preferredAirlines",
    "passport",
    "emergencyContact",
  ];
  const present = required.length - missing.length;
  const score = Math.round((present / required.length) * 100);
  return { score, missing, readyForHandsFreeBooking: missing.length === 0 };
}

async function loadCompletenessCounts(userId) {
  const [passportCount, emergencyCount] = await Promise.all([
    prisma.travellerIdentityDocument.count({
      where: {
        ownerUserId: userId,
        companionId: null,
        type: "PASSPORT",
        status: "ACTIVE",
      },
    }),
    prisma.emergencyContact.count({ where: { profileUserId: userId } }),
  ]);
  return {
    hasPassport: passportCount > 0,
    hasEmergencyContact: emergencyCount > 0,
  };
}

async function withCompleteness(profile) {
  if (!profile) return profile;
  const counts = await loadCompletenessCounts(profile.userId);
  return {
    ...profile,
    completeness: computeProfileCompleteness(profile, counts),
  };
}

/** GET /api/v1/profile — get or auto-create an empty profile for this user. */
export async function getOrCreateProfile(userId) {
  const existing = await prisma.travellerProfile.findUnique({
    where: { userId },
    select: PROFILE_SELECT,
  });
  if (existing) return withCompleteness(existing);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new AppError(404, "User not found");

  const created = await prisma.travellerProfile.create({
    data: {
      userId,
      displayName: defaultDisplayName(user),
    },
    select: PROFILE_SELECT,
  });
  return withCompleteness(created);
}

/** PATCH /api/v1/profile — update profile fields (auto-creates first if missing). */
export async function updateProfile(userId, patch) {
  const before = await getOrCreateProfile(userId);

  const updated = await prisma.travellerProfile.update({
    where: { userId },
    data: patch,
    select: PROFILE_SELECT,
  });

  const { isMaterialProfileChange, enqueueCustomerUpsertedSafe, CUSTOMER_UPSERT_SOURCES } =
    await import("../operations/integrations/crm/customerUpsert.producer.js");

  if (isMaterialProfileChange(before, updated, patch)) {
    await enqueueCustomerUpsertedSafe({
      userId,
      source: CUSTOMER_UPSERT_SOURCES.PROFILE_UPDATE,
    });
  }

  return withCompleteness(updated);
}
