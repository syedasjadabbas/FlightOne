"use client";

import Link from "next/link";
import { Button, SearchableSelect } from "@/components/ui";
import {
  useListProjectCodesQuery,
  useSetBookingProjectCodeMutation,
} from "@/lib/api/corporate.api";

type ApprovalGate = {
  corporate?: boolean;
  canProceed?: boolean;
  approvalStatus?: string | null;
  companyId?: string | null;
  policyEvaluation?: {
    withinPolicy?: boolean;
    violations?: { code: string; message: string }[];
  } | null;
};

export function CheckoutCorporateSection({
  bookingId,
  bookingStatus,
  bookingMetadata,
  approvalGate,
  corpCompanyId,
  corpMode,
  payMethod,
  setPayMethod,
  busy,
  onRequestApproval,
}: {
  bookingId: string;
  bookingStatus?: string;
  bookingMetadata?: Record<string, unknown> | null;
  approvalGate: ApprovalGate;
  corpCompanyId: string | null;
  corpMode: string;
  payMethod: "card" | "corporate_credit";
  setPayMethod: (m: "card" | "corporate_credit") => void;
  busy: boolean;
  onRequestApproval: () => void;
}) {
  if (!approvalGate?.corporate) return null;

  const companyId = corpCompanyId || approvalGate.companyId || null;
  const attachedId =
    typeof bookingMetadata?.projectCodeId === "string"
      ? bookingMetadata.projectCodeId
      : null;
  const attachedCode =
    typeof bookingMetadata?.projectCode === "string" ? bookingMetadata.projectCode : null;
  const attachedName =
    typeof bookingMetadata?.projectCodeName === "string"
      ? bookingMetadata.projectCodeName
      : null;
  const canSelect = bookingStatus === "QUOTED" && Boolean(companyId);

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[16px]">🏢</span>
        <h3 className="text-[14px] font-bold text-slate-900">Corporate Approval & Spend</h3>
      </div>
      <p className="text-[12px] text-slate-600">
        Status: <strong className="text-slate-900">{approvalGate.approvalStatus || "REQUIRED"}</strong> ·{" "}
        {approvalGate.canProceed ? "can proceed" : "blocked until approved"}
      </p>
      {approvalGate.policyEvaluation && !approvalGate.policyEvaluation.withinPolicy ? (
        <ul className="text-[12px] text-[var(--danger)]">
          {(approvalGate.policyEvaluation.violations || []).map((v) => (
            <li key={v.code}>{v.message}</li>
          ))}
        </ul>
      ) : null}
      {!approvalGate.canProceed &&
      (approvalGate.approvalStatus === "REQUIRED" || !approvalGate.approvalStatus) &&
      companyId ? (
        <Button size="sm" type="button" disabled={busy} onClick={onRequestApproval}>
          Request approval
        </Button>
      ) : null}
      <Link href="/corporate" className="block text-[12px] text-[var(--sky)] underline">
        Corporate desk
      </Link>

      {companyId ? (
        <ProjectCodePicker
          bookingId={bookingId}
          companyId={companyId}
          canSelect={canSelect}
          attachedId={attachedId}
          attachedCode={attachedCode}
          attachedName={attachedName}
          busy={busy}
        />
      ) : null}

      {corpMode === "CORPORATE" ? (
        <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
          <input
            type="radio"
            name="payMethod"
            checked={payMethod === "corporate_credit"}
            onChange={() => setPayMethod("corporate_credit")}
          />
          Pay with corporate credit
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-[13px] text-ink-soft">
        <input
          type="radio"
          name="payMethod"
          checked={payMethod === "card"}
          onChange={() => setPayMethod("card")}
        />
        Pay with card token
      </label>
    </div>
  );
}

function ProjectCodePicker({
  bookingId,
  companyId,
  canSelect,
  attachedId,
  attachedCode,
  attachedName,
  busy,
}: {
  bookingId: string;
  companyId: string;
  canSelect: boolean;
  attachedId: string | null;
  attachedCode: string | null;
  attachedName: string | null;
  busy: boolean;
}) {
  const { data: codes = [], isLoading } = useListProjectCodesQuery({
    companyId,
    activeOnly: true,
  });
  const [setProjectCode, { isLoading: saving, error }] = useSetBookingProjectCodeMutation();

  return (
    <div className="mt-2 space-y-1.5 border-t border-line/70 pt-2">
      <p className="text-[12px] font-medium text-ink">Project code</p>
      {attachedCode ? (
        <p className="text-[12px] text-ink-soft">
          {attachedCode}
          {attachedName ? ` — ${attachedName}` : ""}
        </p>
      ) : null}
      {canSelect ? (
        isLoading ? (
          <p className="text-[12px] text-ink-faint">Loading project codes…</p>
        ) : !codes.length ? (
          <p className="text-[12px] text-ink-faint">
            No active project codes. Ask a company admin to add one on /corporate.
          </p>
        ) : (
          <SearchableSelect
            options={[
              {
                value: "",
                label: attachedCode ? "Change project code…" : "Select project code (optional)",
              },
              ...codes.map((c) => ({
                value: c.id,
                label: `${c.code} — ${c.name}`,
              })),
            ]}
            value={attachedId && codes.some((c) => c.id === attachedId) ? attachedId : ""}
            onChange={(id) => {
              if (!id) return;
              void setProjectCode({ bookingId, projectCodeId: id });
            }}
            disabled={busy || saving}
            placeholder={
              attachedCode ? "Change project code…" : "Select project code (optional)"
            }
          />
        )
      ) : null}
      {error ? (
        <p className="text-[12px] text-[var(--danger)]">Could not attach project code.</p>
      ) : null}
    </div>
  );
}
