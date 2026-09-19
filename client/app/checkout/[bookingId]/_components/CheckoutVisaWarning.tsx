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

  const isCaution = visaWarning.severity === "caution";

  return (
    <div
      className={`rounded-2xl border p-5 shadow-xs space-y-2.5 ${
        isCaution
          ? "border-amber-200 bg-amber-50/70 text-amber-950"
          : "border-blue-200 bg-blue-50/70 text-blue-950"
      }`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span className="text-[16px]">{isCaution ? "⚠️" : "ℹ️"}</span>
        <p className="text-[14px] font-bold">{visaWarning.title}</p>
      </div>

      <p className="text-[13px] leading-relaxed text-slate-700">{visaWarning.body}</p>

      <p className="text-[11px] text-slate-500">
        {visaWarning.isFact
          ? "Attributed catalog fact — still not a booking block."
          : "Guidance only — not confirmed visa eligibility."}
        {visaWarning.escalateRecommended ? " Consider consultant review via Visa or Chat." : ""}
      </p>

      <div>
        <Link
          href="/visa"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 underline hover:text-blue-700"
        >
          Open visa intelligence check →
        </Link>
      </div>
    </div>
  );
}
