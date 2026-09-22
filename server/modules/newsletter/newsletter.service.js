import prisma from "../../config/prisma.js";

/**
 * Idempotent — resubmitting an already-subscribed email is a no-op success,
 * not an error (the footer form has no way to tell the user "you're already on it").
 */
export async function subscribeToNewsletter({ email, source = "footer" }) {
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {},
    create: { email, source },
  });
  return { email };
}
