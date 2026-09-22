"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileDown, Receipt } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api/apiErrorMessage";
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
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  /**
   * Row actions were fire-and-forget `void mutation()`: a click produced no
   * feedback and a rejected request vanished silently. One runner gives every
   * row action the same success/failure reporting as the forms above.
   */
  const runRowAction = async (
    action: Promise<unknown> | { unwrap: () => Promise<unknown> },
    okText: string,
    failText: string,
  ) => {
    setMsg(null);
    try {
      await ("unwrap" in action ? action.unwrap() : action);
      setMsg({ text: okText });
    } catch (err) {
      setMsg({ text: apiErrorMessage(err, failText), error: true });
    }
  };

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
            setMsg({ text: "Amount must be a non-negative integer (minor units).", error: true });
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
            setMsg({ text: "Expense saved as draft" });
          } catch (err) {
            setMsg({
              text: apiErrorMessage(
                err,
                "Could not create expense (check per-diem policy / trip ownership).",
              ),
              error: true,
            });
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
                <th className="fo-desk__table-num">Amount</th>
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
                  <td className="fo-desk__table-num">{money(e.amountMinor, e.currency)}</td>
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
                          onClick={() =>
                            void runRowAction(
                              submitExpense({ companyId, expenseId: e.id }),
                              "Expense submitted for approval",
                              "Could not submit expense.",
                            )
                          }
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
                              void runRowAction(
                                decideExpense({
                                  companyId,
                                  expenseId: e.id,
                                  decision: "APPROVE",
                                }),
                                "Expense approved",
                                "Could not approve expense.",
                              )
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={() =>
                              void runRowAction(
                                decideExpense({
                                  companyId,
                                  expenseId: e.id,
                                  decision: "REJECT",
                                }),
                                "Expense rejected",
                                "Could not reject expense.",
                              )
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
                          onClick={() =>
                            void runRowAction(
                              reimburse({ companyId, expenseId: e.id }),
                              "Expense marked reimbursed",
                              "Could not mark expense reimbursed.",
                            )
                          }
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
                              setMsg({ text: "Receipt recorded" });
                            } catch (err) {
                              setMsg({
                                text: apiErrorMessage(
                                  err,
                                  "Receipt was not stored (check file type / storage).",
                                ),
                                error: true,
                              });
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
                  setMsg({ text: "Per-diem policy saved" });
                } catch (err) {
                  setMsg({
                    text: apiErrorMessage(err, "Could not save per-diem policy."),
                    error: true,
                  });
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
                  setMsg({
                    text: out.submittedExternally
                      ? "Export downloaded"
                      : out.integration.reason ||
                        "Local CSV downloaded — not sent to payroll.",
                  });
                } catch (err) {
                  setMsg({ text: apiErrorMessage(err, "Export failed."), error: true });
                }
              }}
            >
              Download reimbursement export
            </Button>
          </div>
        </>
      ) : null}
      {msg ? (
        <p
          className={`fo-corporate__status ${
            msg.error ? "fo-corporate__status--error" : "fo-corporate__status--ok"
          }`}
          role={msg.error ? "alert" : "status"}
        >
          {msg.error ? (
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
