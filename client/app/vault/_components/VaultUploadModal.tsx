"use client";

import { createPortal } from "react-dom";
import { Check, Lock, UploadCloud, X } from "lucide-react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import type { VaultDocType } from "@/lib/api/vault.api";
import {
  VisaMetaFields,
  type VisaMetaFormValue,
} from "./VisaMetaFields";

const UPLOAD_TYPES: Array<{ value: VaultDocType; label: string }> = [
  { value: "PASSPORT", label: "Passport (Biometric Scan)" },
  { value: "NATIONAL_ID", label: "National ID / CNIC Card" },
  { value: "RESIDENCE_PERMIT", label: "Residence Permit / Green Card" },
  { value: "VISA", label: "Entry Visa (E-Visa / Stamp)" },
  { value: "TICKET", label: "Flight Ticket / E-Ticket PDF" },
  { value: "HOTEL_VOUCHER", label: "Hotel Voucher / Reservation" },
  { value: "INSURANCE", label: "Travel Medical Insurance" },
  { value: "TRAVEL_CERT", label: "Vaccination / Travel Certificate" },
  { value: "FF_CARD", label: "Frequent Flyer / Airline Card" },
  { value: "LOYALTY_CARD", label: "Hotel / Travel Loyalty Card" },
  { value: "OTHER", label: "Other Travel Credential" },
];

const UPLOAD_PHASE_LABEL: Record<"idle" | "transferring" | "saving", string> = {
  idle: "Save to Vault",
  transferring: "Uploading file…",
  saving: "Encrypting & saving…",
};

export function VaultUploadModal({
  uploadTitle,
  uploadType,
  uploadIssue,
  uploadExpiry,
  uploadFile,
  uploadVisa,
  uploading,
  uploadPhase = "idle",
  actionError,
  onTitleChange,
  onTypeChange,
  onIssueChange,
  onExpiryChange,
  onFileChange,
  onVisaChange,
  onClose,
  onSubmit,
}: {
  uploadTitle: string;
  uploadType: VaultDocType;
  uploadIssue: string;
  uploadExpiry: string;
  uploadFile: File | null;
  uploadVisa: VisaMetaFormValue;
  uploading: boolean;
  uploadPhase?: "idle" | "transferring" | "saving";
  actionError: string | null;
  onTitleChange: (v: string) => void;
  onTypeChange: (v: VaultDocType) => void;
  onIssueChange: (v: string) => void;
  onExpiryChange: (v: string) => void;
  onFileChange: (f: File | null) => void;
  onVisaChange: (v: VisaMetaFormValue) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const dialog = (
    <div className="fo-vault__overlay" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-upload-title"
        className="fo-vault__dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-vault__dialog-head">
          <div>
            <p className="fo-vault__dialog-kicker">
              <Lock size={12} strokeWidth={2.2} aria-hidden />
              <span>AES-256 ENCRYPTED VAULT STORAGE</span>
            </p>
            <h3 id="vault-upload-title" className="fo-vault__dialog-title">
              Add Travel Document
            </h3>
            <p className="fo-vault__dialog-sub">
              Upload passports, visas, loyalty cards, and travel vouchers for automated booking.
            </p>
          </div>
          <button
            type="button"
            className="fo-vault__close"
            onClick={onClose}
            aria-label="Close upload dialog"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="fo-vault__dialog-form">
          <div className="fo-vault__dialog-body">
            <SearchableSelect
              id="vault-upload-type"
              label="Document Classification"
              options={UPLOAD_TYPES}
              value={uploadType}
              onChange={(v) => onTypeChange(v as VaultDocType)}
              searchable={false}
            />

            <Input
              id="vault-upload-title-input"
              label="Document Title"
              value={uploadTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. US B1/B2 10-Year Visa, Pakistan Passport"
              required
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="vault-upload-issue"
                label="Issue Date (optional)"
                type="date"
                value={uploadIssue}
                onChange={(e) => onIssueChange(e.target.value)}
              />
              <Input
                id="vault-upload-expiry"
                label="Expiration Date (optional)"
                type="date"
                value={uploadExpiry}
                onChange={(e) => onExpiryChange(e.target.value)}
                hint="Used for 90-day renewal reminders"
              />
            </div>

            {uploadType === "VISA" ? (
              <VisaMetaFields value={uploadVisa} onChange={onVisaChange} disabled={uploading} />
            ) : null}

            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                Document Scan (PDF, JPG, PNG, WebP)
              </p>
              <label className={`fo-vault__dropzone${uploading ? " fo-vault__dropzone--busy" : ""}`}>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky/10 text-sky">
                  {uploadPhase === "transferring" ? (
                    <Spinner size="sm" className="border-sky/30 border-t-sky" label={null} />
                  ) : (
                    <UploadCloud size={20} strokeWidth={2} />
                  )}
                </div>
                {uploadPhase === "transferring" ? (
                  <div className="text-center">
                    <span className="fo-vault__dropzone-file flex items-center justify-center gap-1">
                      {uploadFile?.name}
                    </span>
                    <span className="text-[11.5px] text-sky font-semibold">
                      Uploading to encrypted storage…
                    </span>
                  </div>
                ) : uploadFile ? (
                  <div className="text-center">
                    <span className="fo-vault__dropzone-file flex items-center justify-center gap-1">
                      <Check size={14} strokeWidth={2.5} className="text-emerald" />
                      <span>{uploadFile.name}</span>
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to encrypt
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-[13px] font-medium text-navy">
                      <span className="fo-vault__dropzone-accent">Click to browse</span> or drag file here
                    </span>
                    <p className="mt-0.5 text-[11.5px] text-ink-faint">
                      High resolution recommended for instant AI OCR verification
                    </p>
                  </div>
                )}
              </label>
            </div>

            {actionError ? (
              <p className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2 text-xs font-semibold text-danger" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>

          <div className="fo-vault__dialog-foot">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading} size="md">
              {uploading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  <span>{UPLOAD_PHASE_LABEL[uploadPhase]}</span>
                </>
              ) : (
                UPLOAD_PHASE_LABEL.idle
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
