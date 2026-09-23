/**
 * Switches demo companies to PKR so corporate checkout accepts the PKR demo
 * fares. The currency check in corporate.service.js is correct business logic
 * — this aligns the data rather than weakening the rule.
 *
 * Run: node scripts/demo-company-currency.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to rewrite company currency in production");
  }

  const before = await prisma.company.findMany({
    select: { id: true, name: true, currency: true },
  });
  console.log("Before:", before);

  const { count } = await prisma.company.updateMany({
    where: { currency: { not: "PKR" } },
    data: { currency: "PKR" },
  });

  console.log(`Updated ${count} company/companies to PKR`);
  console.log(
    "After:",
    await prisma.company.findMany({ select: { id: true, name: true, currency: true } }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
