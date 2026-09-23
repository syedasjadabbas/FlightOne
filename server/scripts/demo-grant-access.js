/**
 * Gives the demo account the Super Admin role so it can open the management
 * dashboard and ops desk.
 *
 * `prisma/seed.js` assigns this role locally but deliberately skips the demo
 * user in production. This is the explicit, opt-in way to do it on a demo
 * deployment. Only touches the one demo user; never creates users or roles.
 *
 * In production, Super Admin logins require TOTP unless the server also runs
 * with AUTH_SUPER_ADMIN_TRUSTED_MFA=true (which applies to every Super Admin).
 *
 * Run: DEMO_SEED=true node scripts/demo-grant-access.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_EMAIL = (process.env.DEMO_USER_EMAIL || "demo@flightone.local").trim().toLowerCase();

async function main() {
  if (process.env.DEMO_SEED !== "true") {
    throw new Error("Refusing to run: set DEMO_SEED=true to grant demo access");
  }

  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (!user) throw new Error(`No user ${DEMO_EMAIL} — sign up or seed it first`);

  const role = await prisma.role.findFirst({ where: { name: "Super Admin" }, select: { id: true } });
  if (!role) throw new Error('No "Super Admin" role — run `npm run db:seed` first');

  // companyId null can't go through the compound-unique upsert (see seed.js).
  const existing = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, companyId: null },
    select: { id: true },
  });
  if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  console.log(`${DEMO_EMAIL}: Super Admin ${existing ? "already assigned" : "assigned"}`);
  if (process.env.NODE_ENV === "production" && process.env.AUTH_SUPER_ADMIN_TRUSTED_MFA !== "true") {
    console.log("Note: without AUTH_SUPER_ADMIN_TRUSTED_MFA=true, the next login will ask for 2FA setup.");
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
