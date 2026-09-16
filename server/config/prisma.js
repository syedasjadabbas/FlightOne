import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function datasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  const defaultPool = 25;
  const defaultTimeout = 30;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        String(process.env.DATABASE_POOL_SIZE || defaultPool),
      );
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        String(process.env.DATABASE_POOL_TIMEOUT || defaultTimeout),
      );
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.PRISMA_QUERY_LOG
      ? [{ emit: "event", level: "query" }, "error", "warn"]
      : process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.PRISMA_QUERY_LOG) {
  const slowMs = Number(process.env.PRISMA_SLOW_MS || 0);
  prisma.$on("query", (e) => {
    if (e.duration >= slowMs) {
      // eslint-disable-next-line no-console
      console.log(`[q] ${e.duration}ms ${e.query.slice(0, 200)}`);
    }
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
