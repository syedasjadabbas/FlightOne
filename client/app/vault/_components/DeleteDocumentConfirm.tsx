"use client";

import { Button } from "@/components/ui";
import { AlertTriangle, X } from "lucide-react";

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
            <p className="fo-vault__dialog-kicker">
              <AlertTriangle size={11} strokeWidth={2} aria-hidden />
              Confirm removal
            </p>
            <h3 id="vault-delete-title" className="fo-vault__dialog-title">
              Remove document?
            </h3>
          </div>
          <button
            type="button"
            className="fo-vault__close"
            onClick={onCancel}
            aria-label="Cancel"
            disabled={busy}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="fo-vault__dialog-body">
          <p className="m-0 text-sm leading-relaxed text-[var(--ink-soft)]">
            “{title}” will be removed from your Vault. Platform-issued tickets and vouchers cannot
            be deleted. This does not permanently purge audit history.
          </p>
          <div className="fo-vault__dialog-foot justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="fo-vault__btn-danger"
            >
              {busy ? "Removing…" : "Delete document"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
