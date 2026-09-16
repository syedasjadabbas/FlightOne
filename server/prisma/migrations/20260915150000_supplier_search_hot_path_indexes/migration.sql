-- Hot-path indexes for supplier search reliability aggregation + dashboard funnel counts.
-- Expand-only (non-blocking CREATE INDEX CONCURRENTLY not used — matches existing migration style).

CREATE INDEX IF NOT EXISTS "Booking_supplierCode_status_idx"
  ON "Booking"("supplierCode", "status");

CREATE INDEX IF NOT EXISTS "DashboardSearchEvent_createdAt_product_idx"
  ON "DashboardSearchEvent"("createdAt", "product");
