-- Module 06 — optional company markup bps for Module 05 companyMarkupBps hook.
-- Does not invent negotiated-rate tables; null means no corporate override.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "markupBps" INTEGER;
