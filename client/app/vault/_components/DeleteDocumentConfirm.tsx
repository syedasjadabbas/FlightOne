"use client";

import { Button } from "@/components/ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-delete-title"
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <h3 id="vault-delete-title" className="text-lg font-bold text-slate-900 font-[var(--font-sora)]">
          Remove document?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          “{title}” will be removed from your Vault. Platform-issued tickets and vouchers cannot be
          deleted. This does not permanently purge audit history.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
            {busy ? "Removing…" : "Delete document"}
          </Button>
        </div>
      </div>
    </div>
  );
}
