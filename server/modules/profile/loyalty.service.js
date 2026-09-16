import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { getOrCreateProfile } from "./profile.service.js";

const LOYALTY_SELECT = {
  id: true,
  profileUserId: true,
  type: true,
  programCode: true,
  memberNumber: true,
  createdAt: true,
};

/** GET /api/v1/profile/loyalty — list this user's loyalty memberships. */
export async function listLoyaltyMemberships(profileUserId) {
  return prisma.loyaltyMembership.findMany({
    where: { profileUserId },
    select: LOYALTY_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** POST /api/v1/profile/loyalty — add a loyalty membership for this user. */
export async function addLoyaltyMembership(profileUserId, data) {
  await getOrCreateProfile(profileUserId);

  const duplicate = await prisma.loyaltyMembership.findFirst({
    where: {
      profileUserId,
      type: data.type,
      programCode: data.programCode,
      memberNumber: data.memberNumber,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(409, "Loyalty membership already saved");
  }

  return prisma.loyaltyMembership.create({
    data: { profileUserId, ...data },
    select: LOYALTY_SELECT,
  });
}

async function findOwnLoyaltyOrThrow(profileUserId, id) {
  const row = await prisma.loyaltyMembership.findUnique({
    where: { id },
    select: { id: true, profileUserId: true },
  });
  if (!row || row.profileUserId !== profileUserId) {
    throw new AppError(404, "Loyalty membership not found");
  }
  return row;
}

/** PATCH /api/v1/profile/loyalty/:id */
export async function updateLoyaltyMembership(profileUserId, id, patch) {
  await findOwnLoyaltyOrThrow(profileUserId, id);
  return prisma.loyaltyMembership.update({
    where: { id },
    data: patch,
    select: LOYALTY_SELECT,
  });
}

/** DELETE /api/v1/profile/loyalty/:id */
export async function deleteLoyaltyMembership(profileUserId, id) {
  await findOwnLoyaltyOrThrow(profileUserId, id);
  await prisma.loyaltyMembership.delete({ where: { id } });
}
