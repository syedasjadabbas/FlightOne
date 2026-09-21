"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

export function DeleteDocumentConfirm({
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fo-vault__overlay" role="presentation" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-delete-title"
        className="fo-vault__dialog fo-vault__dialog--sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fo-vault__dialog-head">
          <div>
            <p className="fo-vault__dialog-kicker text-danger">
              <AlertTriangle size={12} strokeWidth={2.2} className="text-danger" aria-hidden />
              <span>PERMANENT REMOVAL</span>
            </p>
            <h3 id="vault-delete-title" className="fo-vault__dialog-title">
              Delete Document?
            </h3>
          </div>
          <button
            type="button"
            className="fo-vault__close"
            onClick={onCancel}
            aria-label="Cancel deletion"
            disabled={busy}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="fo-vault__dialog-body">
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-soft">
            “<strong className="text-navy">{title}</strong>” will be purged from your encrypted Travel Vault.
            Platform-issued tickets and immutable vouchers cannot be deleted.
          </p>
        </div>

        <div className="fo-vault__dialog-foot">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={busy}
            icon={!busy ? <Trash2 size={13} strokeWidth={2} /> : undefined}
          >
            {busy ? (
              <>
                <Spinner size="sm" className="border-danger/30 border-t-danger" label={null} />
                <span>Removing…</span>
              </>
            ) : (
              "Confirm Delete"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
