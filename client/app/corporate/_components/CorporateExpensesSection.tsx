"use client";

import { useState } from "react";
import { CheckCircle2, FileDown, Receipt } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  useAttachExpenseReceiptMutation,
  useCreateExpenseMutation,
  useDecideExpenseMutation,
  useLazyExportExpensesQuery,
  useListExpensesQuery,
  useListPerDiemPoliciesQuery,
  useReimburseExpenseMutation,
  useSubmitExpenseMutation,
  useUpsertPerDiemPolicyMutation,
} from "@/lib/api/corporate.api";
import { DeskSectionHead, DeskStatus } from "./DeskSectionHead";

function money(minor: number, currency?: string | null) {
  return `${currency || ""} ${(minor / 100).toFixed(2)}`.trim();
}

const selectClass =
  "mt-1 w-full rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--white)] px-2.5 py-1.5 text-sm text-[var(--navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--cyan)_55%,transparent)]";

function expenseTone(status: string): "neutral" | "ok" | "warn" {
  if (/APPROVED|REIMBURSED|PAID/i.test(status)) return "ok";
  if (/REJECT|FAIL|VOID/i.test(status)) return "warn";
  return "neutral";
}

export function CorporateExpensesSection({
  companyId,
  isAdmin,
  isApprover,
  bookings,
}: {
  companyId: string;
  isAdmin: boolean;
  isApprover: boolean;
  bookings: Array<{ id: string; product?: string; status?: string }>;
}) {
  const { data } = useListExpensesQuery({ companyId });
  const { data: perDiem } = useListPerDiemPoliciesQuery(companyId);
  const [createExpense] = useCreateExpenseMutation();
  const [submitExpense] = useSubmitExpenseMutation();
  const [decideExpense] = useDecideExpenseMutation();
  const [reimburse] = useReimburseExpenseMutation();
  const [attachReceipt] = useAttachExpenseReceiptMutation();
  const [exportExpenses] = useLazyExportExpensesQuery();
  const [upsertPerDiem] = useUpsertPerDiemPolicyMutation();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("MEALS");
  const [bookingId, setBookingId] = useState("");
  const [daily, setDaily] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <DeskSectionHead icon={Receipt} title="Expenses" />

      <p className="text-xs text-[var(--ink-soft)]">
        {data?.ocr?.configured
          ? "Receipt OCR is configured."
          : data?.ocr?.reason || "Receipt OCR is not configured — amounts are never invented."}
      </p>
      <p className="text-xs text-[var(--ink-soft)]">
        {perDiem?.configured
          ? `Per-diem policy active (${perDiem.items[0]?.currency} ${((perDiem.items[0]?.dailyAmountMinor || 0) / 100).toFixed(2)} / day).`
          : perDiem?.emptyReason || "No corporate per-diem policy is configured."}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label="Amount (minor units)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Merchant"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
      </div>
      <label className="block text-xs font-medium text-[var(--ink-soft)]">
        Category
        <select
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["MEALS", "TRANSPORT", "HOTEL", "FLIGHT", "PER_DIEM", "OTHER"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--ink-soft)]">
        Link trip (optional)
        <select
          className={selectClass}
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
        >
          <option value="">No trip link</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.product || "TRIP"} · {b.status} · {b.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <Button
        size="sm"
        type="button"
        disabled={!amount.trim()}
        onClick={async () => {
          setMsg(null);
          const n = Number(amount);
          if (!Number.isInteger(n) || n < 0) {
            setMsg("Amount must be a non-negative integer (minor units).");
            return;
          }
          try {
            await createExpense({
              companyId,
              amountMinor: n,
              category,
              merchant: merchant.trim() || undefined,
              bookingId: bookingId || undefined,
              days: category === "PER_DIEM" ? 1 : undefined,
            }).unwrap();
            setAmount("");
            setMerchant("");
            setMsg("Expense saved as draft");
          } catch {
            setMsg("Could not create expense (check per-diem policy / trip ownership).");
          }
        }}
      >
        Add expense
      </Button>

      {!data?.items?.length ? (
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          No expenses yet.
        </p>
      ) : (
        <div className="fo-desk__table-wrap -mx-1">
          <table className="fo-desk__table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Status</th>
                <th>OCR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="font-medium text-[var(--navy)]">
                      {e.merchant || e.category}
                    </span>
                    {e.bookingId ? (
                      <span className="mt-0.5 block text-[11px] text-[var(--ink-faint)]">
                        Trip linked
                      </span>
                    ) : null}
                  </td>
                  <td>{money(e.amountMinor, e.currency)}</td>
                  <td>
                    <DeskStatus tone={expenseTone(e.status)}>{e.status}</DeskStatus>
                  </td>
                  <td className="text-[var(--ink-soft)]">{e.ocrStatus}</td>
                  <td>
                    <div className="fo-desk__toolbar">
                      {e.status === "DRAFT" || e.status === "REJECTED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() => void submitExpense({ companyId, expenseId: e.id })}
                        >
                          Submit
                        </Button>
                      ) : null}
                      {isApprover && e.status === "PENDING_APPROVAL" ? (
                        <>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() =>
                              void decideExpense({
                                companyId,
                                expenseId: e.id,
                                decision: "APPROVE",
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={() =>
                              void decideExpense({
                                companyId,
                                expenseId: e.id,
                                decision: "REJECT",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {isAdmin &&
                      (e.status === "REIMBURSEMENT_PENDING" || e.status === "APPROVED") ? (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => void reimburse({ companyId, expenseId: e.id })}
                        >
                          Mark reimbursed
                        </Button>
                      ) : null}
                      <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[var(--cyan)] underline-offset-2 hover:underline">
                        <FileDown className="h-3 w-3" aria-hidden />
                        Receipt
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="sr-only"
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            ev.target.value = "";
                            if (!file) return;
                            const dataUrl = await new Promise<string>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(String(reader.result || ""));
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            });
                            const b64 = dataUrl.includes(",")
                              ? dataUrl.slice(dataUrl.indexOf(",") + 1)
                              : dataUrl;
                            try {
                              await attachReceipt({
                                companyId,
                                expenseId: e.id,
                                contentBase64: b64,
                                contentType: file.type || "application/pdf",
                                originalFilename: file.name,
                              }).unwrap();
                              setMsg("Receipt recorded");
                            } catch {
                              setMsg("Receipt was not stored (check file type / storage).");
                            }
                          }}
                        />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <>
          <Input
            label="Per-diem daily amount (minor units)"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
          />
          <div className="fo-desk__toolbar">
            <Button
              size="sm"
              type="button"
              disabled={!daily.trim()}
              onClick={async () => {
                const n = Number(daily);
                if (!Number.isInteger(n) || n < 0) return;
                try {
                  await upsertPerDiem({
                    companyId,
                    dailyAmountMinor: n,
                    name: "Standard per diem",
                  }).unwrap();
                  setMsg("Per-diem policy saved");
                } catch {
                  setMsg("Could not save per-diem policy.");
                }
              }}
            >
              Save per-diem policy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={async () => {
                try {
                  const out = await exportExpenses({ companyId }).unwrap();
                  const csv = atob(out.contentBase64);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = out.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                  setMsg(
                    out.submittedExternally
                      ? "Export downloaded"
                      : out.integration.reason ||
                          "Local CSV downloaded — not sent to payroll.",
                  );
                } catch {
                  setMsg("Export failed.");
                }
              }}
            >
              Download reimbursement export
            </Button>
          </div>
        </>
      ) : null}
      {msg ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
          {msg}
        </p>
      ) : null}
    </section>
  );
}
