"use client";

import { FileUp, Lock, X } from "lucide-react";
import { Button, Input, SearchableSelect } from "@/components/ui";
import type { VaultDocType } from "@/lib/api/vault.api";
import {
  VisaMetaFields,
  type VisaMetaFormValue,
} from "./VisaMetaFields";

const UPLOAD_TYPES: Array<{ value: VaultDocType; label: string; category: string }> = [
  { value: "PASSPORT", label: "Passport", category: "Identification" },
  { value: "NATIONAL_ID", label: "National ID / CNIC", category: "Identification" },
  { value: "RESIDENCE_PERMIT", label: "Residence Permit", category: "Identification" },
  { value: "VISA", label: "Visa", category: "Travel Entry" },
  { value: "TICKET", label: "Ticket", category: "Travel" },
  { value: "HOTEL_VOUCHER", label: "Hotel Voucher", category: "Travel" },
  { value: "INSURANCE", label: "Travel Insurance", category: "Coverage" },
  { value: "TRAVEL_CERT", label: "Travel Certificate", category: "Travel Entry" },
  { value: "FF_CARD", label: "Frequent Flyer Card", category: "Loyalty" },
  { value: "LOYALTY_CARD", label: "Hotel / Travel Loyalty Card", category: "Loyalty" },
  { value: "OTHER", label: "Other Document", category: "General" },
];

export function VaultUploadModal({
  uploadTitle,
  uploadType,
  uploadIssue,
  uploadExpiry,
  uploadFile,
  uploadVisa,
  uploading,
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
  return (
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
              <Lock size={11} strokeWidth={2} aria-hidden />
              Encrypted upload
            </p>
            <h3 id="vault-upload-title" className="fo-vault__dialog-title">
              Add document
            </h3>
            <p className="fo-vault__dialog-sub">PDF or image · stored in your vault</p>
          </div>
          <button type="button" className="fo-vault__close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="fo-vault__dialog-body">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--ink-soft)]">
              Document type
            </label>
            <SearchableSelect
              options={UPLOAD_TYPES}
              value={uploadType}
              onChange={(v) => onTypeChange(v as VaultDocType)}
              searchable
            />
          </div>

          <Input
            label="Document title"
            value={uploadTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. US B1/B2 Visa, Pakistan Passport"
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Issue date (optional)"
              type="date"
              value={uploadIssue}
              onChange={(e) => onIssueChange(e.target.value)}
            />
            <Input
              label="Expiration date (optional)"
              type="date"
              value={uploadExpiry}
              onChange={(e) => onExpiryChange(e.target.value)}
              hint="Used for renewal reminders"
            />
          </div>

          {uploadType === "VISA" ? (
            <VisaMetaFields value={uploadVisa} onChange={onVisaChange} disabled={uploading} />
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--ink-soft)]">
              File (PDF, JPEG, PNG, WebP)
            </label>
            <div className="fo-vault__dropzone">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
              <FileUp size={20} strokeWidth={1.75} className="text-[var(--navy)]" aria-hidden />
              {uploadFile ? (
                <span className="fo-vault__dropzone-file">
                  {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              ) : (
                <>
                  <span>
                    <span className="fo-vault__dropzone-accent">Choose a file</span> or drop here
                  </span>
                  <span className="text-[11px] text-[var(--ink-faint)]">Max size per vault policy</span>
                </>
              )}
            </div>
          </div>

          {actionError ? (
            <p className="text-xs font-semibold text-[var(--danger)]">{actionError}</p>
          ) : null}

          <div className="fo-vault__dialog-foot justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload document"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
