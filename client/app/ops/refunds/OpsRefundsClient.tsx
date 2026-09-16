"use client";

import Link from "next/link";
import { Button, Pagination, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useListRefundCasesQuery,
  useProcessRefundCaseMutation,
  useRejectRefundCaseMutation,
} from "@/lib/api/refunds.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import { useState } from "react";

const PAGE_SIZE_DEFAULT = 15;

export function OpsRefundsClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { isLoading: permsLoading, has } = usePermissions();
  const canRead = has("refunds:read");
  const canWrite = has("refunds:write");
  const { data, isLoading, refetch } = useListRefundCasesQuery(undefined, {
    skip: skip || !canRead,
  });
  const [processCase] = useProcessRefundCaseMutation();
  const [rejectCase] = useRejectRefundCaseMutation();
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!accessToken) {
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Sign in required.</p>
      </div>
    );
  }

  return (
    <PermissionGate
      anyOf={["refunds:read"]}
      mode="fallback"
      fallback={
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Refunds ops</h1>
          <p className="fo-desk__lede">Missing `refunds:read` permission.</p>
          <div className="fo-desk__links">
            <Link href="/refunds">Customer refunds</Link>
          </div>
        </header>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Refunds queue</h1>
          <p className="fo-desk__lede">
            Process only confirms completion when payment/supplier paths succeed — otherwise
            REQUIRES_HUMAN / FAILED. Exchange and reissue stay REQUIRES_HUMAN until an agent
            completes the ticket change outside live GDS mutation.
          </p>
          <div className="fo-desk__links">
            <Link href="/ops">← Operations</Link>
          </div>
        </header>
        {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}
        {isLoading ? (
          <Spinner />
        ) : !data?.items?.length ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">No cases.</p>
          </div>
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Status</th>
                    <th>Booking</th>
                    <th>Case</th>
                    {canWrite ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginateItems(data.items, page, pageSize).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/refunds/${c.id}`}>
                          {(c.kind || "REFUND").replaceAll("_", " ")}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={
                            ["REQUIRES_HUMAN", "FAILED"].includes(c.status)
                              ? "fo-desk__status fo-desk__status--warn"
                              : "fo-desk__status"
                          }
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="fo-desk__mono">{c.bookingId}</td>
                      <td className="fo-desk__mono">{c.id.slice(0, 10)}…</td>
                      {canWrite ? (
                        <td>
                          {["SUBMITTED", "PROCESSING", "REQUIRES_HUMAN"].includes(c.status) ? (
                            <div className="fo-desk__toolbar">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  setMsg(null);
                                  try {
                                    const r = await processCase(c.id).unwrap();
                                    setMsg(`Processed → ${r.status}`);
                                    refetch();
                                  } catch {
                                    setMsg("Process failed.");
                                  }
                                }}
                              >
                                Process
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  setMsg(null);
                                  try {
                                    await rejectCase({ id: c.id, reason: "Rejected by ops" }).unwrap();
                                    setMsg("Rejected.");
                                    refetch();
                                  } catch {
                                    setMsg("Reject failed.");
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageCount={pageCountFor(data.items.length, pageSize)}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalItems={data.items.length}
              label="Refund cases"
            />
          </section>
        )}
      </div>
    </PermissionGate>
  );
}
