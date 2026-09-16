"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Pagination,
  Spinner,
  pageCountFor,
  paginateItems,
} from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useCreateOpsReconciliationMutation,
  useDrainOpsOutboxMutation,
  useGetOpsFinanceQuery,
  useGetOpsOverviewQuery,
  useListOpsAccountingQuery,
  useListOpsAuditQuery,
  useListOpsCommissionsQuery,
  useListOpsOutboxQuery,
  useListOpsReconciliationQuery,
  useRetryOpsOutboxMutation,
  type OpsIntegrationCapability,
} from "@/lib/api/operations.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";

type Tab =
  | "overview"
  | "integrations"
  | "outbox"
  | "accounting"
  | "finance"
  | "commissions"
  | "reconcile"
  | "audit";

const TABLE_PAGE_SIZE = 15;

function StatePill({ state }: { state: string }) {
  const warn =
    /FAIL|MISMATCH|UNCONFIG|ERROR|ATTENTION/i.test(state) ||
    state === "SKIPPED_UNCONFIGURED";
  return (
    <span className={warn ? "fo-desk__status fo-desk__status--warn" : "fo-desk__status"}>
      {state}
    </span>
  );
}

function IntegrationRow({ cap }: { cap: OpsIntegrationCapability }) {
  return (
    <tr>
      <td className="font-medium">{cap.name}</td>
      <td>
        <StatePill state={cap.state} />
      </td>
      <td className="text-ink-faint">
        {(cap.reasons || []).length ? (cap.reasons || []).join(" · ") : "—"}
      </td>
    </tr>
  );
}

function TablePager({
  itemsLength,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label,
}: {
  itemsLength: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  label: string;
}) {
  return (
    <Pagination
      page={page}
      pageCount={pageCountFor(itemsLength, pageSize)}
      onPageChange={onPageChange}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      totalItems={itemsLength}
      label={label}
    />
  );
}

export function OpsPlatformClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { isLoading: permsLoading, has } = usePermissions();
  const canRead = has("ops:dashboard:read");
  const canEvents = has("ops:events:read");
  const canReconcile = has("ops:reconcile:write");

  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [invoicedMinor, setInvoicedMinor] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } =
    useGetOpsOverviewQuery(undefined, { skip: skip || !canRead });
  const { data: outbox, isLoading: outboxLoading, refetch: refetchOutbox } = useListOpsOutboxQuery(
    undefined,
    { skip: skip || !canEvents },
  );
  const { data: accounting, isLoading: accountingLoading } = useListOpsAccountingQuery(undefined, {
    skip: skip || !canRead || tab !== "accounting",
  });
  const { data: finance, isLoading: financeLoading } = useGetOpsFinanceQuery(
    bookingId ? { bookingId } : undefined,
    { skip: skip || !canRead || tab !== "finance" },
  );
  const { data: commissions, isLoading: commissionsLoading } = useListOpsCommissionsQuery(
    undefined,
    { skip: skip || !canRead || tab !== "commissions" },
  );
  const { data: recon, isLoading: reconLoading, refetch: refetchRecon } =
    useListOpsReconciliationQuery(undefined, {
      skip: skip || !canRead || tab !== "reconcile",
    });
  const { data: audit, isLoading: auditLoading } = useListOpsAuditQuery(undefined, {
    skip: skip || !canRead || tab !== "audit",
  });

  const [drain] = useDrainOpsOutboxMutation();
  const [retry] = useRetryOpsOutboxMutation();
  const [createRecon] = useCreateOpsReconciliationMutation();

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "integrations" as const, label: "Integrations" },
        { id: "outbox" as const, label: "Outbox" },
        { id: "accounting" as const, label: "Accounting" },
        { id: "finance" as const, label: "Finance" },
        { id: "commissions" as const, label: "Commissions" },
        { id: "reconcile" as const, label: "Reconciliation" },
        { id: "audit" as const, label: "Audit" },
      ] as const,
    [],
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
        <p className="fo-desk__empty">Sign in required.</p>
      </div>
    );
  }
  if (!canRead) {
    return (
      <header className="fo-desk__header">
        <h1 className="fo-desk__title">Operations</h1>
        <p className="fo-desk__lede">Missing `ops:dashboard:read` permission.</p>
        <div className="fo-desk__links">
          <Link href="/ops/escalations">Escalations ops</Link>
          <Link href="/ops/refunds">Refunds ops</Link>
        </div>
      </header>
    );
  }

  return (
    <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
      <header className="fo-desk__header">
        <h1 className="fo-desk__title">Operations</h1>
        <p className="fo-desk__lede">
          Integration status, finance visibility, commissions, reconciliation, and audit. External
          systems stay unconfigured until credentials are set.
        </p>
        <div className="fo-desk__links">
          <Link href="/ops/escalations">Escalations</Link>
          <Link href="/ops/refunds">Refunds</Link>
          <Link href="/ops/knowledge">Knowledge</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </header>

      <nav className="fo-desk__tabs" aria-label="Operations sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`fo-desk__tab${tab === t.id ? " fo-desk__tab--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}

      {tab === "overview" ? (
        overviewLoading ? (
          <Spinner />
        ) : overview ? (
          <div className="fo-desk__kpi-strip" aria-label="Ops overview">
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Outbox pending</p>
              <p className="fo-desk__kpi-value">{overview.outbox.pending}</p>
              <p className="fo-desk__kpi-note">
                failed {overview.outbox.failed} · delivered {overview.outbox.delivered}
                {overview.outbox.retrying ? ` · retrying ${overview.outbox.retrying}` : ""}
                {overview.outbox.unconfigured
                  ? ` · unconfigured ${overview.outbox.unconfigured}`
                  : ""}
              </p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Ledger</p>
              <p className="fo-desk__kpi-value">{overview.accountingEntries}</p>
              <p className="fo-desk__kpi-note">commissions {overview.commissions}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Recon attention</p>
              <p className="fo-desk__kpi-value">{overview.reconciliation.needsAttention}</p>
              <p className="fo-desk__kpi-note">mismatches {overview.reconciliation.mismatches}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Outbox failed</p>
              <p className="fo-desk__kpi-value">{overview.outbox.failed}</p>
              <p className="fo-desk__kpi-note">
                {overview.outbox.processing ? `processing ${overview.outbox.processing}` : "steady"}
              </p>
            </div>
          </div>
        ) : (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">No overview data.</p>
          </div>
        )
      ) : null}

      {tab === "integrations" ? (
        overviewLoading ? (
          <Spinner />
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Integration</th>
                    <th>State</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(overview?.integrations || {}).map((cap) => (
                    <IntegrationRow key={cap.name} cap={cap} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : null}

      {tab === "outbox" ? (
        <div className="fo-desk__stack">
          <div className="fo-desk__toolbar">
            <Button
              size="sm"
              disabled={!canReconcile}
              onClick={async () => {
                setMsg(null);
                try {
                  const r = await drain({ limit: 50 }).unwrap();
                  setMsg(
                    `Drain → delivered ${r.delivered}, failed ${r.failed}, deferred ${r.deferred ?? 0}, unconfigured ${r.unconfigured ?? 0}`,
                  );
                  refetchOutbox();
                  refetchOverview();
                } catch {
                  setMsg("Drain failed (needs ops:reconcile:write).");
                }
              }}
            >
              Drain pending
            </Button>
            {canReconcile ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  setMsg(null);
                  try {
                    const r = await retry({ limit: 50 }).unwrap();
                    setMsg(`Retry → delivered ${r.delivered}, failed ${r.failed}`);
                    refetchOutbox();
                    refetchOverview();
                  } catch {
                    setMsg("Retry failed.");
                  }
                }}
              >
                Retry failed
              </Button>
            ) : null}
          </div>
          {!canEvents ? (
            <div className="fo-desk__panel">
              <p className="fo-desk__empty">Missing `ops:events:read`.</p>
            </div>
          ) : outboxLoading ? (
            <Spinner />
          ) : !outbox?.items?.length ? (
            <div className="fo-desk__panel">
              <p className="fo-desk__empty">Outbox empty.</p>
            </div>
          ) : (
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Aggregate</th>
                      <th>Attempts</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(outbox.items, page, pageSize).map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{e.type}</td>
                        <td>
                          <StatePill state={e.displayStatus || e.status} />
                        </td>
                        <td className="fo-desk__mono">
                          {e.aggregateType}/{e.aggregateId}
                        </td>
                        <td>{e.attempts}</td>
                        <td className="text-ink-faint">{e.lastError || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                itemsLength={outbox.items.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                label="Outbox events"
              />
            </section>
          )}
        </div>
      ) : null}

      {tab === "accounting" ? (
        accountingLoading ? (
          <Spinner />
        ) : !accounting?.items?.length ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">
              No internal accounting entries yet (created on BOOKING_TICKETED, PAYMENT_CAPTURED,
              BOOKING_REFUNDED).
            </p>
          </div>
        ) : (
          <div className="fo-desk__stack">
            {accounting.aggregates?.length ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                  <h2 className="fo-desk__section-label">Ledger totals</h2>
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Currency</th>
                        <th>Sum</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounting.aggregates.map((a) => (
                        <tr key={`${a.currency}-${a.entryType}`}>
                          <td>{a.entryType}</td>
                          <td>{a.currency}</td>
                          <td>{(a.amountMinorSum / 100).toFixed(2)}</td>
                          <td>{a.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Booking</th>
                      <th>Memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(accounting.items, page, pageSize).map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{e.entryType}</td>
                        <td>
                          {e.currency} {(e.amountMinor / 100).toFixed(2)}
                        </td>
                        <td className="fo-desk__mono">{e.bookingId || "—"}</td>
                        <td className="text-ink-faint">
                          {e.memo || "—"}
                          {e.companyId ? ` · company ${e.companyId}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                itemsLength={accounting.items.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                label="Accounting entries"
              />
            </section>
          </div>
        )
      ) : null}

      {tab === "finance" ? (
        <div className="fo-desk__stack">
          <label className="block text-[13px] text-ink-soft">
            Booking ID (optional filter)
            <input
              className="mt-1 w-full rounded border border-[var(--fo-desk-line)] bg-white px-3 py-2 text-[14px]"
              value={bookingId}
              onChange={(ev) => setBookingId(ev.target.value.trim())}
              placeholder="cuid…"
            />
          </label>
          {financeLoading ? (
            <Spinner />
          ) : (
            <>
              {finance?.capability ? (
                <section className="fo-desk__panel fo-desk__panel--flush">
                  <div className="fo-desk__table-wrap">
                    <table className="fo-desk__table">
                      <thead>
                        <tr>
                          <th>Integration</th>
                          <th>State</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        <IntegrationRow cap={finance.capability} />
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              {finance?.externalAccounting ? (
                <div className="fo-desk__panel">
                  <p className="text-[13px] text-ink">
                    External accounting: {finance.externalAccounting.syncStatus} /{" "}
                    {finance.externalAccounting.dataAvailability}
                  </p>
                  {!finance.externalAccounting.configured ? (
                    <p className="mt-1 text-[12px] text-ink-soft">
                      Internal ledger is shown below. External sync is not claimed while
                      unconfigured.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                  <h2 className="fo-desk__section-label">Payments</h2>
                  <span className="fo-desk__meta">
                    {finance?.payments?.total ?? 0} payments · {finance?.refundCases?.length ?? 0}{" "}
                    refund cases · {finance?.accountingEntries?.length ?? 0} accounting rows
                  </span>
                </div>
                {finance?.aggregates?.accounting?.length ? (
                  <div className="fo-desk__table-wrap">
                    <table className="fo-desk__table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Currency</th>
                          <th>Sum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finance.aggregates.accounting.map((a) => (
                          <tr key={`${a.currency}-${a.entryType}`}>
                            <td>{a.entryType}</td>
                            <td>{a.currency}</td>
                            <td>{(a.amountMinorSum / 100).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {!finance?.payments?.items?.length ? (
                  <p className="fo-desk__empty">No payment rows for filter.</p>
                ) : (
                  <>
                    <div className="fo-desk__table-wrap">
                      <table className="fo-desk__table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Booking</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginateItems(finance.payments.items, page, pageSize).map((p) => (
                            <tr key={p.id}>
                              <td>{p.status}</td>
                              <td>
                                {p.currency} {(p.amountMinor / 100).toFixed(2)}
                              </td>
                              <td className="fo-desk__mono">{p.bookingId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePager
                      itemsLength={finance.payments.items.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      label="Payments"
                    />
                  </>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}

      {tab === "commissions" ? (
        commissionsLoading ? (
          <Spinner />
        ) : (
          <div className="fo-desk__stack">
            {commissions?.capability ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th>State</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <IntegrationRow cap={commissions.capability} />
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {!commissions?.items?.length ? (
              <div className="fo-desk__panel">
                <p className="fo-desk__empty">
                  No commission records. Configure OPS_COMMISSION_BPS (or PricingConfig
                  ops_commission_bps) — rates are never invented.
                </p>
              </div>
            ) : (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>BPS</th>
                        <th>Amount</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginateItems(commissions.items, page, pageSize).map((c) => (
                        <tr key={c.id}>
                          <td className="fo-desk__mono">{c.bookingId}</td>
                          <td>{c.commissionBps}</td>
                          <td>
                            {c.currency} {(c.commissionMinor / 100).toFixed(2)}
                          </td>
                          <td>
                            {c.supplierCode || "—"}
                            {c.companyId ? ` · ${c.companyId}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  itemsLength={commissions.items.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  label="Commission rows"
                />
                {commissions.aggregates?.length ? (
                  <div className="fo-desk__table-wrap" style={{ borderTop: "1px solid var(--fo-desk-line)" }}>
                    <table className="fo-desk__table">
                      <thead>
                        <tr>
                          <th>Currency</th>
                          <th>Total</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.aggregates.map((a) => (
                          <tr key={a.currency}>
                            <td>{a.currency}</td>
                            <td>{(a.commissionMinorSum / 100).toFixed(2)}</td>
                            <td>{a.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            )}
          </div>
        )
      ) : null}

      {tab === "reconcile" ? (
        <div className="fo-desk__stack">
          <PermissionGate
            anyOf={["ops:reconcile:write"]}
            mode="fallback"
            fallback={
              <div className="fo-desk__panel">
                <p className="fo-desk__empty">Missing `ops:reconcile:write` for writes.</p>
              </div>
            }
          >
            <section className="fo-desk__panel fo-desk__stack">
              <p className="text-[13px] text-ink-soft">
                Reconcile a booking against an authoritative supplier invoice amount. Leave invoiced
                blank → DATA_UNAVAILABLE (never invents supplier data).
              </p>
              <input
                className="w-full rounded border border-[var(--fo-desk-line)] bg-white px-3 py-2 text-[14px]"
                placeholder="bookingId"
                value={bookingId}
                onChange={(ev) => setBookingId(ev.target.value.trim())}
              />
              <input
                className="w-full rounded border border-[var(--fo-desk-line)] bg-white px-3 py-2 text-[14px]"
                placeholder="invoicedMinor (optional)"
                value={invoicedMinor}
                onChange={(ev) => setInvoicedMinor(ev.target.value)}
              />
              <Button
                size="sm"
                onClick={async () => {
                  setMsg(null);
                  if (!bookingId) {
                    setMsg("bookingId required");
                    return;
                  }
                  try {
                    const r = await createRecon({
                      bookingId,
                      invoicedMinor:
                        invoicedMinor === "" ? null : Number.parseInt(invoicedMinor, 10),
                    }).unwrap();
                    setMsg(`Recon → ${r.status}`);
                    refetchRecon();
                  } catch {
                    setMsg("Reconcile failed.");
                  }
                }}
              >
                Run reconciliation
              </Button>
            </section>
          </PermissionGate>
          {reconLoading ? (
            <Spinner />
          ) : !recon?.items?.length ? (
            <div className="fo-desk__panel">
              <p className="fo-desk__empty">No reconciliation items.</p>
            </div>
          ) : (
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Booking</th>
                      <th>Expected</th>
                      <th>Invoiced</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(recon.items, page, pageSize).map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.supplierCode}</td>
                        <td>
                          <StatePill state={r.status} />
                        </td>
                        <td className="fo-desk__mono">{r.bookingId || "—"}</td>
                        <td>{r.expectedMinor}</td>
                        <td>{r.invoicedMinor ?? "n/a"}</td>
                        <td className="text-ink-faint">{r.mismatchReason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                itemsLength={recon.items.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                label="Reconciliation items"
              />
            </section>
          )}
        </div>
      ) : null}

      {tab === "audit" ? (
        auditLoading ? (
          <Spinner />
        ) : !audit?.items?.length ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">No audit rows in this page.</p>
          </div>
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {paginateItems(audit.items, page, pageSize).map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.action}</td>
                      <td className="fo-desk__mono">
                        {a.resourceType}/{a.resourceId || "—"}
                      </td>
                      <td>{new Date(a.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager
              itemsLength={audit.items.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="Audit log"
            />
          </section>
        )
      ) : null}
    </div>
  );
}
