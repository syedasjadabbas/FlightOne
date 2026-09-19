-- Phase 3 P3-02 — predictive recommendation notification preferences.
-- History, snapshots, and feedback remain the signal sources.

CREATE TABLE IF NOT EXISTS "PredictivePreference" (
    "userId" TEXT NOT NULL,
    "proactiveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictivePreference_pkey" PRIMARY KEY ("userId")
);
