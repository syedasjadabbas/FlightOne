-- Module 17 — minimal search funnel instrumentation for booking conversion.

CREATE TABLE IF NOT EXISTS "DashboardSearchEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "product" "BookingProduct" NOT NULL,
  "supplierCode" TEXT,
  "resultCount" INT NOT NULL DEFAULT 0,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DashboardSearchEvent_createdAt_idx" ON "DashboardSearchEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "DashboardSearchEvent_product_idx" ON "DashboardSearchEvent"("product");
CREATE INDEX IF NOT EXISTS "DashboardSearchEvent_supplierCode_idx" ON "DashboardSearchEvent"("supplierCode");
CREATE INDEX IF NOT EXISTS "DashboardSearchEvent_userId_idx" ON "DashboardSearchEvent"("userId");
