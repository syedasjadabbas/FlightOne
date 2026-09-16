import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { getOrCreateProfile } from "./profile.service.js";

const CONTACT_SELECT = {
  id: true,
  profileUserId: true,
  fullName: true,
  relationship: true,
  phone: true,
  email: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
};

/** GET /api/v1/profile/emergency-contacts */
export async function listEmergencyContacts(profileUserId) {
  return prisma.emergencyContact.findMany({
    where: { profileUserId },
    select: CONTACT_SELECT,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

/** POST /api/v1/profile/emergency-contacts */
export async function createEmergencyContact(profileUserId, data) {
  await getOrCreateProfile(profileUserId);

  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.emergencyContact.updateMany({
        where: { profileUserId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.emergencyContact.create({
      data: { profileUserId, ...data },
      select: CONTACT_SELECT,
    });
  });
}

async function findOwnContactOrThrow(profileUserId, id) {
  const row = await prisma.emergencyContact.findUnique({
    where: { id },
    select: { id: true, profileUserId: true },
  });
  if (!row || row.profileUserId !== profileUserId) {
    throw new AppError(404, "Emergency contact not found");
  }
  return row;
}

/** PATCH /api/v1/profile/emergency-contacts/:id */
export async function updateEmergencyContact(profileUserId, id, patch) {
  await findOwnContactOrThrow(profileUserId, id);

  return prisma.$transaction(async (tx) => {
    if (patch.isPrimary === true) {
      await tx.emergencyContact.updateMany({
        where: { profileUserId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }
    return tx.emergencyContact.update({
      where: { id },
      data: patch,
      select: CONTACT_SELECT,
    });
  });
}

/** DELETE /api/v1/profile/emergency-contacts/:id */
export async function deleteEmergencyContact(profileUserId, id) {
  await findOwnContactOrThrow(profileUserId, id);
  await prisma.emergencyContact.delete({ where: { id } });
}
