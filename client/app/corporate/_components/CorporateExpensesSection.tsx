"use client";

import { useState } from "react";
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

function money(minor: number, currency?: string | null) {
  return `${currency || ""} ${(minor / 100).toFixed(2)}`.trim();
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
      <h2 className="fo-desk__section-label">Expenses</h2>
      <p className="text-xs text-slate-600">
        {data?.ocr?.configured
          ? "Receipt OCR is configured."
          : data?.ocr?.reason || "Receipt OCR is not configured — amounts are never invented."}
      </p>
      <p className="text-xs text-slate-600">
        {perDiem?.configured
          ? `Per-diem policy active (${perDiem.items[0]?.currency} ${((perDiem.items[0]?.dailyAmountMinor || 0) / 100).toFixed(2)} / day).`
          : perDiem?.emptyReason || "No corporate per-diem policy is configured."}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Amount (minor units)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </div>
      <label className="text-xs text-slate-600">
        Category
        <select
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
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
      <label className="text-xs text-slate-600">
        Link trip (optional)
        <select
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
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
        <p className="fo-desk__empty">No expenses yet.</p>
      ) : (
        <div className="fo-desk__table-wrap">
          <table className="fo-desk__table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Status</th>
                <th>OCR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.merchant || e.category}
                    {e.bookingId ? <span className="block text-[11px] text-slate-400">Trip linked</span> : null}
                  </td>
                  <td>{money(e.amountMinor, e.currency)}</td>
                  <td>{e.status}</td>
                  <td>{e.ocrStatus}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {e.status === "DRAFT" || e.status === "REJECTED" ? (
                        <button
                          type="button"
                          className="text-[11px] text-cyan-700"
                          onClick={() => void submitExpense({ companyId, expenseId: e.id })}
                        >
                          Submit
                        </button>
                      ) : null}
                      {isApprover && e.status === "PENDING_APPROVAL" ? (
                        <>
                          <button
                            type="button"
                            className="text-[11px] text-cyan-700"
                            onClick={() =>
                              void decideExpense({ companyId, expenseId: e.id, decision: "APPROVE" })
                            }
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-slate-600"
                            onClick={() =>
                              void decideExpense({ companyId, expenseId: e.id, decision: "REJECT" })
                            }
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {isAdmin && (e.status === "REIMBURSEMENT_PENDING" || e.status === "APPROVED") ? (
                        <button
                          type="button"
                          className="text-[11px] text-cyan-700"
                          onClick={() => void reimburse({ companyId, expenseId: e.id })}
                        >
                          Mark reimbursed
                        </button>
                      ) : null}
                      <label className="text-[11px] text-slate-500 cursor-pointer">
                        Receipt
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
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
                            const b64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
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
          <Input label="Per-diem daily amount (minor units)" value={daily} onChange={(e) => setDaily(e.target.value)} />
          <Button
            size="sm"
            type="button"
            disabled={!daily.trim()}
            onClick={async () => {
              const n = Number(daily);
              if (!Number.isInteger(n) || n < 0) return;
              try {
                await upsertPerDiem({ companyId, dailyAmountMinor: n, name: "Standard per diem" }).unwrap();
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
                    : out.integration.reason || "Local CSV downloaded — not sent to payroll.",
                );
              } catch {
                setMsg("Export failed.");
              }
            }}
          >
            Download reimbursement export
          </Button>
        </>
      ) : null}
      {msg ? <p className="text-[13px] text-slate-600">{msg}</p> : null}
    </section>
  );
}
