"use client";

import Link from "next/link";

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

  return (
    <div
      className={
        visaWarning.severity === "caution"
          ? "fo-checkout__alert space-y-2"
          : "fo-checkout__notice space-y-2"
      }
      role="status"
    >
      <p className="text-[14px] font-medium text-[var(--navy)]">{visaWarning.title}</p>
      <p className="text-[13px] text-ink-soft">{visaWarning.body}</p>
      <p className="text-[12px] text-ink-faint">
        {visaWarning.isFact
          ? "Attributed catalog fact — still not a booking block."
          : "Guidance only — not confirmed visa eligibility."}
        {visaWarning.escalateRecommended ? " Consider consultant review via Visa or Chat." : ""}
      </p>
      <Link
        href="/visa"
        className="inline-block text-[13px] text-[var(--sky)] underline-offset-2 hover:underline"
      >
        Open visa check
      </Link>
    </div>
  );
}
