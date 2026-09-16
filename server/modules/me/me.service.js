import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) throw new AppError(404, "User not found");
  return user;
}
