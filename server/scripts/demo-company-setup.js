/**
 * Aligns demo companies with the PKR demo corpus so the corporate UI shows
 * believable numbers: PKR currency and a credit limit large enough for several
 * long-haul bookings.
 *
 * This is DATA, not a bypass. The corporate spend gate is skipped separately
 * (and only in demo mode) inside corporate.service.js — this script exists so
 * the demo doesn't display a company with a zero credit limit.
 *
 * Run: node scripts/demo-company-setup.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** PKR 50,000,000 — comfortably above a business-class long-haul demo fare. */
const DEMO_CREDIT_LIMIT_MINOR = 5_000_000_000;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to rewrite company finance fields in production");
  }

  const before = await prisma.company.findMany({
    select: { id: true, name: true, currency: true, creditLimitMinor: true, creditUsedMinor: true },
  });
  console.log("Before:", before);

  for (const company of before) {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        currency: "PKR",
        // Only raise — never lower a limit someone deliberately configured.
        ...(company.creditLimitMinor < DEMO_CREDIT_LIMIT_MINOR
          ? { creditLimitMinor: DEMO_CREDIT_LIMIT_MINOR }
          : {}),
        creditUsedMinor: 0,
        isActive: true,
      },
    });
  }

  const after = await prisma.company.findMany({
    select: { id: true, name: true, currency: true, creditLimitMinor: true, creditUsedMinor: true },
  });
  console.log(`Updated ${after.length} company/companies`);
  console.log("After:", after);
  for (const c of after) {
    console.log(
      `  ${c.name}: ${c.currency} ${(c.creditLimitMinor - c.creditUsedMinor) / 100} available`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
