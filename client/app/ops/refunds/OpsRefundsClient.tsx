"use client";

import { useMemo, useState } from "react";
import { Pagination, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useListRefundCasesQuery,
  useProcessRefundCaseMutation,
  useRejectRefundCaseMutation,
} from "@/lib/api/refunds.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import {
  OpsRefundCaseRow,
  OpsRefundsEmpty,
  OpsRefundsHeader,
  OpsRefundsPermissionGate,
  OpsRefundsSignInGate,
  OpsRefundsSummary,
  STATUS_FILTERS,
  filterCases,
  statusFilterLabel,
  summarizeCases,
} from "./_components";

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
  const [msgWarn, setMsgWarn] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("ACTIONABLE");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const items = data?.items ?? [];
  const summary = useMemo(() => summarizeCases(items), [items]);
  const filtered = useMemo(() => filterCases(items, filter), [items, filter]);

  async function handleProcess(id: string) {
    setMsg(null);
    setMsgWarn(false);
    setBusyId(id);
    try {
      const r = await processCase(id).unwrap();
      setMsg(`Processed → ${r.status}`);
      setMsgWarn(r.status === "FAILED" || r.status === "REQUIRES_HUMAN");
      refetch();
    } catch {
      setMsg("Process failed.");
      setMsgWarn(true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setMsg(null);
    setMsgWarn(false);
    setBusyId(id);
    try {
      await rejectCase({ id, reason: "Rejected by ops" }).unwrap();
      setMsg("Rejected.");
      refetch();
    } catch {
      setMsg("Reject failed.");
      setMsgWarn(true);
    } finally {
      setBusyId(null);
    }
  }

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return <OpsRefundsSignInGate />;
  }

  return (
    <PermissionGate anyOf={["refunds:read"]} mode="fallback" fallback={<OpsRefundsPermissionGate />}>
      <div className="fo-ops fo-ops-refunds">
        <OpsRefundsHeader />

        {!isLoading && items.length > 0 ? <OpsRefundsSummary summary={summary} /> : null}

        {msg ? (
          <p className={`fo-ops__msg${msgWarn ? " fo-ops__msg--warn" : ""}`} role="status">
            {msg}
          </p>
        ) : null}

        <div className="fo-desk__toolbar" role="group" aria-label="Status filter">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`fo-desk__chip${filter === f ? " fo-desk__chip--active" : ""}`}
            >
              {statusFilterLabel(f)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12" role="status" aria-live="polite">
            <Spinner />
          </div>
        ) : !items.length ? (
          <OpsRefundsEmpty filtered={false} />
        ) : !filtered.length ? (
          <OpsRefundsEmpty filtered />
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
                  {paginateItems(filtered, page, pageSize).map((c) => (
                    <OpsRefundCaseRow
                      key={c.id}
                      caseItem={c}
                      canWrite={canWrite}
                      busy={busyId === c.id}
                      onProcess={handleProcess}
                      onReject={handleReject}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageCount={pageCountFor(filtered.length, pageSize)}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              totalItems={filtered.length}
              label="Refund cases"
            />
          </section>
        )}
      </div>
    </PermissionGate>
  );
}
