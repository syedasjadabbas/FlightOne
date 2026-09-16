-- Module 04: store offer attributes with feedback so learning can weight future ranks.
ALTER TABLE "RecommendationFeedback" ADD COLUMN IF NOT EXISTS "context" JSONB;
