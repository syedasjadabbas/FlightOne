"use client";

import Link from "next/link";
import { AlertTriangle, Info, ArrowRight } from "lucide-react";

type VisaWarning = {
  show: boolean;
  severity?: string;
  title: string;
  body: string;
  isFact?: boolean;
  escalateRecommended?: boolean;
};

export function CheckoutVisaWarning({ visaWarning }: { visaWarning: VisaWarning | null }) {
  if (!visaWarning?.show) return null;

  const isCaution = visaWarning.severity === "caution";

  return (
    <div
      className={`fo-desk__panel space-y-2 ${
        isCaution
          ? "border-[color-mix(in_oklab,var(--danger)_28%,var(--fo-desk-line))] bg-[color-mix(in_oklab,var(--danger)_5%,var(--white))]"
          : "border-[color-mix(in_oklab,var(--cyan)_28%,var(--fo-desk-line))] bg-[var(--fo-desk-wash)]"
      }`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {isCaution ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyan)]" aria-hidden />
        )}
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-semibold text-[var(--navy)]">{visaWarning.title}</p>
          <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{visaWarning.body}</p>
          <p className="text-[11px] text-[var(--ink-faint)]">
            {visaWarning.isFact
              ? "Catalog fact — not a booking block."
              : "Guidance only — not confirmed visa eligibility."}
            {visaWarning.escalateRecommended ? " Consider a visa or chat review." : ""}
          </p>
          <Link
            href="/visa"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--cyan)] underline-offset-2 hover:underline"
          >
            Open visa check
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
