"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Spinner } from "@/components/ui";
import {
  useApplyDocumentOcrMutation,
  useRunDocumentOcrMutation,
  useUpdateDocumentMutation,
  type IdentityDocument,
  type OcrExtractionResult,
} from "@/lib/api/profile.api";
import {
  buildOcrConfirmPlan,
  classifyOcrOutcome,
  editableFieldsFromExtraction,
  emptyEditableFields,
  ocrStatusMessage,
  type EditableOcrFields,
  type OcrUiStatus,
} from "@/lib/profile/ocrReview";

type Props = {
  document: IdentityDocument;
  /** Compact layout for Vault list rows. */
  compact?: boolean;
};

function statusTone(status: OcrUiStatus): string {
  switch (status) {
    case "success":
      return "text-[var(--success,#1a7f4b)]";
    case "unconfigured":
    case "empty":
      return "text-ink-soft";
    case "failure":
      return "text-[var(--danger)]";
    case "processing":
      return "text-ink";
    default:
      return "text-ink-faint";
  }
}

export function DocumentOcrPanel({ document, compact }: Props) {
  const [runOcr, { isLoading: running }] = useRunDocumentOcrMutation();
  const [applyOcr, { isLoading: applying }] = useApplyDocumentOcrMutation();
  const [updateDoc, { isLoading: patching }] = useUpdateDocumentMutation();

  const [extraction, setExtraction] = useState<OcrExtractionResult | null>(
    document.ocrExtract ?? null,
  );
  const [apiFailed, setApiFailed] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmOk, setConfirmOk] = useState<string | null>(null);
  const [fields, setFields] = useState<EditableOcrFields>(() =>
    editableFieldsFromExtraction(document.ocrExtract?.fields),
  );
  const [reviewOpen, setReviewOpen] = useState(Boolean(document.ocrExtract));

  useEffect(() => {
    if (document.ocrExtract) {
      setExtraction(document.ocrExtract);
      setFields(editableFieldsFromExtraction(document.ocrExtract.fields));
      setReviewOpen(true);
    }
  }, [document.id, document.ocrExtractedAt]);

  const status = useMemo(
    () =>
      classifyOcrOutcome({
        processing: running,
        apiError: apiFailed,
        extraction,
      }),
    [running, apiFailed, extraction],
  );

  const locked = document.verificationStatus === "VERIFIED";
  const noVault = !document.vaultDocumentId;
  const busy = running || applying || patching;
  const plan = useMemo(() => buildOcrConfirmPlan(fields, extraction), [fields, extraction]);

  function setField<K extends keyof EditableOcrFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setConfirmOk(null);
  }

  async function onRunOcr() {
    setApiFailed(false);
    setApiErrorMessage(null);
    setConfirmError(null);
    setConfirmOk(null);
    if (noVault) {
      setApiFailed(true);
      setApiErrorMessage("Link a vault scan before running OCR.");
      return;
    }
    if (locked) {
      setApiFailed(true);
      setApiErrorMessage("Verified documents cannot be OCR-edited; re-upload first.");
      return;
    }
    try {
      const result = await runOcr({ id: document.id }).unwrap();
      setExtraction(result.extraction);
      setFields(editableFieldsFromExtraction(result.extraction.fields));
      setReviewOpen(true);
      // Do not claim success here — classifyOcrOutcome decides from warnings/fields.
    } catch (err) {
      setApiFailed(true);
      setExtraction(null);
      const msg =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ||
                "OCR request failed",
            )
          : "OCR request failed";
      setApiErrorMessage(msg);
      setReviewOpen(true);
    }
  }

  async function onConfirm() {
    setConfirmError(null);
    setConfirmOk(null);
    if (locked) {
      setConfirmError("Verified documents cannot be overwritten; re-upload instead.");
      return;
    }
    if (!plan.canConfirm) {
      setConfirmError("Enter or accept at least one field before confirming.");
      return;
    }
    try {
      if (plan.acceptedFields.length) {
        await applyOcr({
          id: document.id,
          acceptedFields: plan.acceptedFields,
        }).unwrap();
      }
      if (Object.keys(plan.patch).length) {
        await updateDoc({ id: document.id, patch: plan.patch }).unwrap();
      }
      setConfirmOk(
        plan.acceptedFields.length && Object.keys(plan.patch).length
          ? "Saved: OCR fields applied and corrections stored."
          : plan.acceptedFields.length
            ? "Saved: accepted OCR fields applied."
            : "Saved: manually confirmed fields stored.",
      );
    } catch (err) {
      const msg =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ||
                "Could not save confirmed fields",
            )
          : "Could not save confirmed fields";
      setConfirmError(msg);
    }
  }

  return (
    <div
      className={
        compact
          ? "space-y-2 rounded-lg border border-line/80 bg-[var(--surface-2,#fafafa)] px-2.5 py-2"
          : "space-y-3 rounded-xl border border-line bg-[var(--surface-2,#fafafa)] px-3 py-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
          Document Details
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || locked || noVault}
          onClick={() => void onRunOcr()}
        >
          {running ? "Scanning…" : extraction ? "Re-scan Document" : "Auto-scan Document"}
        </Button>
      </div>

      {noVault ? (
        <p className="text-[12px] text-ink-faint">
          Upload a document scan to automatically fill in details securely.
        </p>
      ) : null}

      {locked ? (
        <p className="text-[12px] text-ink-faint">
          Document is verified. Upload a new scan to update details.
        </p>
      ) : null}

      {running ? <Spinner label="Scanning document…" /> : null}

      <p className={`text-[13px] ${statusTone(status)}`} role="status">
        {apiErrorMessage && status === "failure"
          ? apiErrorMessage
          : ocrStatusMessage(status)}
      </p>

      {status === "success" && extraction?.confidence != null ? (
        <p className="text-[12px] text-ink-faint">
          Scan accuracy: {Math.round(extraction.confidence * 100)}%
        </p>
      ) : null}

      {reviewOpen && !locked ? (
        <div className="space-y-2 border-t border-line pt-2">
          <p className="text-[12px] text-ink-soft">
            Review the details below. You can make corrections before saving.
          </p>
          <Input
            label="Document number"
            value={fields.documentNumber}
            onChange={(e) => setField("documentNumber", e.target.value)}
            autoComplete="off"
            hint="Encrypted and securely saved"
          />
          <Input
            label="Country code"
            value={fields.countryCode}
            onChange={(e) => setField("countryCode", e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="PK"
          />
          <Input
            label="Subtype"
            value={fields.documentSubtype}
            onChange={(e) => setField("documentSubtype", e.target.value)}
            hint="Optional (visa type, etc.)"
          />
          <Input
            label="Issue date"
            type="date"
            value={fields.issuedAt}
            onChange={(e) => setField("issuedAt", e.target.value)}
          />
          <Input
            label="Expiry date"
            type="date"
            value={fields.expiresAt}
            onChange={(e) => setField("expiresAt", e.target.value)}
          />
          {extraction?.fields?.fullName ? (
            <p className="text-[12px] text-ink-faint">
              Name detected: {extraction.fields.fullName}
            </p>
          ) : null}
          {confirmError ? (
            <p className="text-[13px] text-[var(--danger)]" role="alert">
              {confirmError}
            </p>
          ) : null}
          {confirmOk ? (
            <p className="text-[13px] text-[var(--success,#1a7f4b)]" role="status">
              {confirmOk}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || !plan.canConfirm}
            onClick={() => void onConfirm()}
          >
            {busy ? "Saving…" : "Save Document Details"}
          </Button>
        </div>
      ) : null}

      {!reviewOpen && !running && !locked && extraction == null ? (
        <button
          type="button"
          className="text-[12px] text-[var(--sky)] underline-offset-2 hover:underline"
          onClick={() => {
            setFields(emptyEditableFields());
            setReviewOpen(true);
          }}
        >
          Enter fields manually without OCR
        </button>
      ) : null}
    </div>
  );
}
