"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Inbox,
  Scale,
  Wallet,
} from "lucide-react";
import {
  Button,
  Pagination,
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
import {
  OpsField,
  OpsHubBoot,
  OpsHubHeader,
  OpsPanelEmpty,
  OpsPanelError,
  OpsPermissionGate,
  OpsSignInGate,
  OpsStatusPill,
  OpsTabLoading,
} from "./_components";

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

function IntegrationRow({ cap }: { cap: OpsIntegrationCapability }) {
  return (
    <tr>
      <td className="font-medium">{cap.name}</td>
      <td>
        <OpsStatusPill state={cap.state} />
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
  const [msgWarn, setMsgWarn] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [invoicedMinor, setInvoicedMinor] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE);
  const [busyAction, setBusyAction] = useState<"drain" | "retry" | "recon" | null>(null);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useGetOpsOverviewQuery(undefined, { skip: skip || !canRead });
  const {
    data: outbox,
    isLoading: outboxLoading,
    isError: outboxError,
    refetch: refetchOutbox,
  } = useListOpsOutboxQuery(undefined, {
    skip: skip || !canEvents,
  });
  const {
    data: accounting,
    isLoading: accountingLoading,
    isError: accountingError,
    refetch: refetchAccounting,
  } = useListOpsAccountingQuery(undefined, {
    skip: skip || !canRead || tab !== "accounting",
  });
  const {
    data: finance,
    isLoading: financeLoading,
    isError: financeError,
    refetch: refetchFinance,
  } = useGetOpsFinanceQuery(bookingId ? { bookingId } : undefined, {
    skip: skip || !canRead || tab !== "finance",
  });
  const {
    data: commissions,
    isLoading: commissionsLoading,
    isError: commissionsError,
    refetch: refetchCommissions,
  } = useListOpsCommissionsQuery(undefined, {
    skip: skip || !canRead || tab !== "commissions",
  });
  const {
    data: recon,
    isLoading: reconLoading,
    isError: reconError,
    refetch: refetchRecon,
  } = useListOpsReconciliationQuery(undefined, {
    skip: skip || !canRead || tab !== "reconcile",
  });
  const {
    data: audit,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useListOpsAuditQuery(undefined, {
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

  function flash(text: string, warn = false) {
    setMsg(text);
    setMsgWarn(warn);
  }

  if (!hasHydrated || permsLoading) {
    return <OpsHubBoot />;
  }
  if (!accessToken) return <OpsSignInGate />;
  if (!canRead) return <OpsPermissionGate />;

  return (
    <div className="fo-ops fo-ops__master-stage">
      <OpsHubHeader />

      <nav className="fo-ops__tabs" aria-label="Operations sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`fo-ops__tab${tab === t.id ? " fo-ops__tab--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg ? (
        <p className={`fo-ops__msg${msgWarn ? " fo-ops__msg--warn" : ""}`} role="status">
          {msg}
        </p>
      ) : null}

      <div className="fo-ops__body">
      {tab === "overview" ? (
        overviewLoading ? (
          <OpsTabLoading label="Loading overview…" />
        ) : overviewError ? (
          <OpsPanelError
            title="Overview unavailable"
            body="Could not load ops KPIs from the server."
            onRetry={() => void refetchOverview()}
          />
        ) : overview ? (
          <div className="fo-desk__kpi-strip" aria-label="Ops overview">
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">
                <Inbox className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
                Outbox pending
              </p>
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
              <p className="fo-desk__kpi-label">
                <Wallet className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
                Ledger
              </p>
              <p className="fo-desk__kpi-value">{overview.accountingEntries}</p>
              <p className="fo-desk__kpi-note">commissions {overview.commissions}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">
                <Scale className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
                Recon attention
              </p>
              <p className="fo-desk__kpi-value">{overview.reconciliation.needsAttention}</p>
              <p className="fo-desk__kpi-note">mismatches {overview.reconciliation.mismatches}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">
                <AlertTriangle className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
                Outbox failed
              </p>
              <p className="fo-desk__kpi-value">{overview.outbox.failed}</p>
              <p className="fo-desk__kpi-note">
                {overview.outbox.processing ? `processing ${overview.outbox.processing}` : "steady"}
              </p>
            </div>
          </div>
        ) : (
          <OpsPanelEmpty title="No overview data" body="Overview returned empty. Try another account or refresh later." />
        )
      ) : null}

      {tab === "integrations" ? (
        overviewLoading ? (
          <OpsTabLoading label="Loading integrations…" />
        ) : overviewError ? (
          <OpsPanelError
            title="Integrations unavailable"
            onRetry={() => void refetchOverview()}
          />
        ) : !Object.keys(overview?.integrations || {}).length ? (
          <OpsPanelEmpty
            title="No integrations listed"
            body="Capability rows appear when the overview payload includes integration states."
          />
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
              disabled={!canReconcile || busyAction !== null}
              onClick={async () => {
                setBusyAction("drain");
                try {
                  const r = await drain({ limit: 50 }).unwrap();
                  flash(
                    `Drain → delivered ${r.delivered}, failed ${r.failed}, deferred ${r.deferred ?? 0}, unconfigured ${r.unconfigured ?? 0}`,
                  );
                  refetchOutbox();
                  refetchOverview();
                } catch {
                  flash("Drain failed (needs ops:reconcile:write).", true);
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              {busyAction === "drain" ? "Draining…" : "Drain pending"}
            </Button>
            {canReconcile ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyAction !== null}
                onClick={async () => {
                  setBusyAction("retry");
                  try {
                    const r = await retry({ limit: 50 }).unwrap();
                    flash(`Retry → delivered ${r.delivered}, failed ${r.failed}`);
                    refetchOutbox();
                    refetchOverview();
                  } catch {
                    flash("Retry failed.", true);
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "retry" ? "Retrying…" : "Retry failed"}
              </Button>
            ) : null}
          </div>
          {!canEvents ? (
            <OpsPanelEmpty
              title="Missing events permission"
              body="Your role needs ops:events:read to view the outbox queue."
            />
          ) : outboxLoading ? (
            <OpsTabLoading label="Loading outbox…" />
          ) : outboxError ? (
            <OpsPanelError title="Outbox unavailable" onRetry={() => void refetchOutbox()} />
          ) : !outbox?.items?.length ? (
            <OpsPanelEmpty title="Outbox empty" body="No pending or failed events in this queue." />
          ) : (
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Aggregate</th>
                      <th className="fo-desk__table-num">Attempts</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(outbox.items, page, pageSize).map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{e.type}</td>
                        <td>
                          <OpsStatusPill state={e.displayStatus || e.status} />
                        </td>
                        <td className="fo-desk__mono">
                          {e.aggregateType}/{e.aggregateId}
                        </td>
                        <td className="fo-desk__table-num">{e.attempts}</td>
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
          <OpsTabLoading label="Loading accounting…" />
        ) : accountingError ? (
          <OpsPanelError title="Accounting unavailable" onRetry={() => void refetchAccounting()} />
        ) : !accounting?.items?.length ? (
          <OpsPanelEmpty
            title="No accounting entries"
            body="Internal ledger rows are created on BOOKING_TICKETED, PAYMENT_CAPTURED, and BOOKING_REFUNDED."
          />
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
                        <th className="fo-desk__table-num">Sum</th>
                        <th className="fo-desk__table-num">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounting.aggregates.map((a) => (
                        <tr key={`${a.currency}-${a.entryType}`}>
                          <td>{a.entryType}</td>
                          <td>{a.currency}</td>
                          <td className="fo-desk__table-num">
                            {(a.amountMinorSum / 100).toFixed(2)}
                          </td>
                          <td className="fo-desk__table-num">{a.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="fo-desk__table-num">Amount</th>
                      <th>Booking</th>
                      <th>Memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(accounting.items, page, pageSize).map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{e.entryType}</td>
                        <td className="fo-desk__table-num">
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
          <OpsField
            id="ops-finance-booking"
            label="Booking ID (optional filter)"
            value={bookingId}
            onChange={(ev) => setBookingId(ev.target.value.trim())}
            placeholder="cuid…"
            autoComplete="off"
          />
          {financeLoading ? (
            <OpsTabLoading label="Loading finance…" />
          ) : financeError ? (
            <OpsPanelError title="Finance unavailable" onRetry={() => void refetchFinance()} />
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
                          <th className="fo-desk__table-num">Sum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finance.aggregates.accounting.map((a) => (
                          <tr key={`${a.currency}-${a.entryType}`}>
                            <td>{a.entryType}</td>
                            <td>{a.currency}</td>
                            <td className="fo-desk__table-num">
                              {(a.amountMinorSum / 100).toFixed(2)}
                            </td>
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
                    <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
                      <table className="fo-desk__table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th className="fo-desk__table-num">Amount</th>
                            <th>Booking</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginateItems(finance.payments.items, page, pageSize).map((p) => (
                            <tr key={p.id}>
                              <td>{p.status}</td>
                              <td className="fo-desk__table-num">
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
          <OpsTabLoading label="Loading commissions…" />
        ) : commissionsError ? (
          <OpsPanelError
            title="Commissions unavailable"
            onRetry={() => void refetchCommissions()}
          />
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
              <OpsPanelEmpty
                title="No commission records"
                body="Configure OPS_COMMISSION_BPS (or PricingConfig ops_commission_bps) — rates are never invented."
              />
            ) : (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th className="fo-desk__table-num">BPS</th>
                        <th className="fo-desk__table-num">Amount</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginateItems(commissions.items, page, pageSize).map((c) => (
                        <tr key={c.id}>
                          <td className="fo-desk__mono">{c.bookingId}</td>
                          <td className="fo-desk__table-num">{c.commissionBps}</td>
                          <td className="fo-desk__table-num">
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
                  <div
                    className="fo-desk__table-wrap"
                    style={{ borderTop: "1px solid var(--fo-desk-line)" }}
                  >
                    <table className="fo-desk__table">
                      <thead>
                        <tr>
                          <th>Currency</th>
                          <th className="fo-desk__table-num">Total</th>
                          <th className="fo-desk__table-num">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.aggregates.map((a) => (
                          <tr key={a.currency}>
                            <td>{a.currency}</td>
                            <td className="fo-desk__table-num">
                              {(a.commissionMinorSum / 100).toFixed(2)}
                            </td>
                            <td className="fo-desk__table-num">{a.count}</td>
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
              <OpsPanelEmpty
                title="Missing reconcile permission"
                body="Your role needs ops:reconcile:write to create reconciliation rows."
              />
            }
          >
            <section className="fo-desk__panel fo-desk__stack">
              <p className="text-[13px] text-ink-soft">
                Reconcile a booking against an authoritative supplier invoice amount. Leave invoiced
                blank → DATA_UNAVAILABLE (never invents supplier data).
              </p>
              <OpsField
                id="ops-recon-booking"
                label="Booking ID"
                placeholder="bookingId"
                value={bookingId}
                onChange={(ev) => setBookingId(ev.target.value.trim())}
                autoComplete="off"
              />
              <OpsField
                id="ops-recon-invoiced"
                label="Invoiced amount (minor units, optional)"
                placeholder="invoicedMinor"
                value={invoicedMinor}
                onChange={(ev) => setInvoicedMinor(ev.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
              <Button
                size="sm"
                disabled={busyAction !== null}
                onClick={async () => {
                  if (!bookingId) {
                    flash("bookingId required", true);
                    return;
                  }
                  setBusyAction("recon");
                  try {
                    const r = await createRecon({
                      bookingId,
                      invoicedMinor:
                        invoicedMinor === "" ? null : Number.parseInt(invoicedMinor, 10),
                    }).unwrap();
                    flash(`Recon → ${r.status}`);
                    refetchRecon();
                  } catch {
                    flash("Reconcile failed.", true);
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "recon" ? "Running…" : "Run reconciliation"}
              </Button>
            </section>
          </PermissionGate>
          {reconLoading ? (
            <OpsTabLoading label="Loading reconciliation…" />
          ) : reconError ? (
            <OpsPanelError title="Reconciliation unavailable" onRetry={() => void refetchRecon()} />
          ) : !recon?.items?.length ? (
            <OpsPanelEmpty
              title="No reconciliation items"
              body="Run a reconciliation above, or wait for supplier invoice checks to land."
            />
          ) : (
            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Booking</th>
                      <th className="fo-desk__table-num">Expected</th>
                      <th className="fo-desk__table-num">Invoiced</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(recon.items, page, pageSize).map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.supplierCode}</td>
                        <td>
                          <OpsStatusPill state={r.status} />
                        </td>
                        <td className="fo-desk__mono">{r.bookingId || "—"}</td>
                        <td className="fo-desk__table-num">{r.expectedMinor}</td>
                        {/* "n/a" is a short marker, not prose, so it still reads as a
                            missing value at the digit edge — and keeping this column
                            aligned with Expected is what makes the two comparable. */}
                        <td className="fo-desk__table-num">{r.invoicedMinor ?? "n/a"}</td>
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
          <OpsTabLoading label="Loading audit…" />
        ) : auditError ? (
          <OpsPanelError title="Audit unavailable" onRetry={() => void refetchAudit()} />
        ) : !audit?.items?.length ? (
          <OpsPanelEmpty title="No audit rows" body="Staff actions will appear here as they are recorded." />
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
            <div className="fo-desk__table-wrap fo-desk__table-wrap--tall">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th className="fo-desk__table-time">When</th>
                  </tr>
                </thead>
                <tbody>
                  {paginateItems(audit.items, page, pageSize).map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.action}</td>
                      <td className="fo-desk__mono">
                        {a.resourceType}/{a.resourceId || "—"}
                      </td>
                      <td className="fo-desk__table-time">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
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
    </div>
  );
}
