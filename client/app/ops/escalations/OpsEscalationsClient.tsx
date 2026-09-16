"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Pagination, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useListOpsEscalationsQuery,
  type EscalationStatus,
} from "@/lib/api/escalations.api";
import { formatOpsRoutingLabel } from "@/lib/escalations/routingDisplay";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";

const FILTERS: Array<EscalationStatus | "ALL"> = [
  "ALL",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
];

const POOL_FILTERS = ["ALL", "VIP", "MEDICAL", "COMPLEX", "GENERAL"] as const;
const PAGE_SIZE_DEFAULT = 15;

export function OpsEscalationsClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [filter, setFilter] = useState<EscalationStatus | "ALL">("OPEN");
  const [pool, setPool] = useState<(typeof POOL_FILTERS)[number]>("ALL");
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
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Sign in as a consultant to view the queue.</p>
      </div>
    );
  }

  return (
    <PermissionGate
      anyOf={["ops:escalations:read"]}
      mode="fallback"
      fallback={
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Consultant queue</h1>
          <p className="fo-desk__lede">
            You do not have permission to view escalations (`ops:escalations:read`).
          </p>
          <div className="fo-desk__links">
            <Link href="/escalations">Your customer escalations</Link>
          </div>
        </header>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Consultant queue</h1>
          <p className="fo-desk__lede">
            Priority-ordered human handoffs with pool routing. Full conversation history is on each
            case. Routing never invents consultant availability.
          </p>
          <div className="fo-desk__links">
            <Link href="/ops">← Operations</Link>
          </div>
        </header>

        <div className="fo-desk__toolbar" role="group" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`fo-desk__chip${filter === f ? " fo-desk__chip--active" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="fo-desk__toolbar" role="group" aria-label="Pool filter">
          {POOL_FILTERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPool(p);
                setPage(1);
              }}
              className={`fo-desk__chip${pool === p ? " fo-desk__chip--active" : ""}`}
            >
              {p === "ALL" ? "All pools" : p}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="fo-desk__panel fo-desk__stack">
            <p className="fo-desk__empty" style={{ padding: 0 }}>
              {(error as { status?: number })?.status === 403
                ? "Not authorized for the ops queue."
                : "Could not load queue."}
            </p>
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !data?.items?.length ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">No escalations in this filter.</p>
          </div>
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
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
                    <tr key={t.id}>
                      <td>
                        <Link href={`/ops/escalations/${t.id}`}>P{t.priority}</Link>
                      </td>
                      <td>
                        <Link href={`/ops/escalations/${t.id}`}>
                          {t.trigger.replaceAll("_", " ")}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={
                            t.routingStatus === "UNROUTED_NO_ELIGIBLE"
                              ? "fo-desk__status fo-desk__status--warn"
                              : "fo-desk__status"
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="text-ink-faint">
                        {formatOpsRoutingLabel(t.routing) || "—"}
                        {t.routingStatus === "UNROUTED_NO_ELIGIBLE" ? " · needs manual Ops" : ""}
                      </td>
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
              label="Escalations queue"
            />
          </section>
        )}
      </div>
    </PermissionGate>
  );
}
