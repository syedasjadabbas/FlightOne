"use client";

import { useState } from "react";
import { Pagination, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useListOpsEscalationsQuery,
  type EscalationStatus,
} from "@/lib/api/escalations.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";
import {
  POOL_FILTERS,
  QueueCaseRow,
  QueueEmpty,
  QueueError,
  QueueFilters,
  QueueHeader,
  QueuePermissionGate,
  QueueSignInGate,
} from "./_components";

const PAGE_SIZE_DEFAULT = 15;

export function OpsEscalationsClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [filter, setFilter] = useState<EscalationStatus | "ALL">("OPEN");
  const [pool, setPool] = useState<(typeof POOL_FILTERS)[number]["value"]>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const skip = !hasHydrated || !accessToken;

  const { isLoading: permsLoading, has } = usePermissions();
  const canRead = has("ops:escalations:read");
  const { data, isLoading, isError, refetch, error } = useListOpsEscalationsQuery(
    {
      ...(filter === "ALL" ? {} : { status: filter }),
      ...(pool === "ALL" ? {} : { pool }),
    },
    { skip: skip || !canRead },
  );

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return <QueueSignInGate />;
  }

  const total = data?.items?.length ?? 0;
  const unauthorized = (error as { status?: number } | undefined)?.status === 403;

  return (
    <PermissionGate anyOf={["ops:escalations:read"]} mode="fallback" fallback={<QueuePermissionGate />}>
      <div className="fo-ops-eq">
        <QueueHeader />

        <QueueFilters
          status={filter}
          pool={pool}
          onStatusChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
          onPoolChange={(next) => {
            setPool(next);
            setPage(1);
          }}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : isError ? (
          <QueueError unauthorized={unauthorized} onRetry={() => refetch()} />
        ) : !data?.items?.length ? (
          <QueueEmpty />
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <p className="fo-ops-eq__summary">
              Showing <strong>{total}</strong> case{total === 1 ? "" : "s"}
            </p>
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table fo-ops-eq__table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>When</th>
                    <th>Routing</th>
                  </tr>
                </thead>
                <tbody>
                  {paginateItems(data.items, page, pageSize).map((t) => (
                    <QueueCaseRow key={t.id} ticket={t} />
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
              label="Escalations queue"
            />
          </section>
        )}
      </div>
    </PermissionGate>
  );
}
