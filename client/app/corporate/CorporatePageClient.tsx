"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  FolderKanban,
  Lock,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button, Input, Pagination, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useCreateApprovalMutation,
  useCreateCompanyMutation,
  useCreateProjectCodeMutation,
  useDecideApprovalMutation,
  useGetActiveCorporateProfileQuery,
  useIssueInvoiceMutation,
  useLazyGetInvoicePdfQuery,
  useListApprovalsQuery,
  useListCompaniesQuery,
  useListCompanyAuditQuery,
  useListCompanyBookingsQuery,
  useListCompanyMembersQuery,
  useListCompanyPoliciesQuery,
  useListInvoicesQuery,
  useListProjectCodesQuery,
  useUpdateCompanyMutation,
  useUpdateInvoiceStatusMutation,
  useUpdateProjectCodeMutation,
} from "@/lib/api/corporate.api";
import { useAuthStore } from "@/store/auth.store";
import { useCorporateProfileStore } from "@/store/corporateProfile.store";
import { CorporatePortalSection } from "./_components/CorporatePortalSection";
import { CorporateExpensesSection } from "./_components/CorporateExpensesSection";
import { CorporateCarbonSection } from "./_components/CorporateCarbonSection";
import { CorporateAnalyticsSection } from "./_components/CorporateAnalyticsSection";
import { DeskSectionHead, DeskStatus } from "./_components/DeskSectionHead";

const TABLE_PAGE_SIZE = 10;

function money(minor: number | undefined, currency?: string | null) {
  if (minor == null) return "—";
  return `${currency || ""} ${(minor / 100).toFixed(2)}`.trim();
}

function invoiceTone(status: string): "neutral" | "ok" | "warn" {
  if (/PAID|SETTLED/i.test(status)) return "ok";
  if (/VOID|FAIL|CANCEL/i.test(status)) return "warn";
  return "neutral";
}

function MsgLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p
      className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]"
      role="status"
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
      {msg}
    </p>
  );
}

export function CorporatePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const mode = useCorporateProfileStore((s) => s.mode);
  const companyId = useCorporateProfileStore((s) => s.companyId);
  const setPersonal = useCorporateProfileStore((s) => s.setPersonal);
  const setCorporate = useCorporateProfileStore((s) => s.setCorporate);

  const skip = !hasHydrated || !accessToken;
  const { data: companies = [], isLoading: companiesLoading } = useListCompaniesQuery(undefined, {
    skip,
  });
  const activeCompanyId = mode === "CORPORATE" ? companyId || companies[0]?.id || null : null;

  const { data: profile, isFetching: profileLoading } = useGetActiveCorporateProfileQuery(
    {
      mode: mode === "CORPORATE" && activeCompanyId ? "CORPORATE" : "PERSONAL",
      companyId: activeCompanyId || undefined,
    },
    { skip },
  );

  const isApprover =
    profile?.membership?.role === "APPROVER" || profile?.membership?.role === "ADMIN";
  const isAdmin = profile?.membership?.role === "ADMIN";

  const { data: approvals } = useListApprovalsQuery(
    { companyId: activeCompanyId || undefined, status: "PENDING" },
    { skip: skip || !activeCompanyId || !isApprover },
  );
  const { data: bookings } = useListCompanyBookingsQuery(
    { companyId: activeCompanyId! },
    { skip: skip || !activeCompanyId },
  );
  const { data: members } = useListCompanyMembersQuery(activeCompanyId!, {
    skip: skip || !activeCompanyId || !isAdmin,
  });
  const { data: policies } = useListCompanyPoliciesQuery(activeCompanyId!, {
    skip: skip || !activeCompanyId,
  });
  const { data: audit } = useListCompanyAuditQuery(
    { companyId: activeCompanyId!, pageSize: 20 },
    { skip: skip || !activeCompanyId || !isAdmin },
  );
  const { data: projectCodes = [] } = useListProjectCodesQuery(
    { companyId: activeCompanyId! },
    { skip: skip || !activeCompanyId },
  );
  const { data: invoices } = useListInvoicesQuery(
    { companyId: activeCompanyId!, pageSize: 20 },
    { skip: skip || !activeCompanyId },
  );

  const [decide] = useDecideApprovalMutation();
  const [createApproval] = useCreateApprovalMutation();
  const [updateCompany] = useUpdateCompanyMutation();
  const [createCompany] = useCreateCompanyMutation();
  const [createProjectCode] = useCreateProjectCodeMutation();
  const [updateProjectCode] = useUpdateProjectCodeMutation();
  const [issueInvoice] = useIssueInvoiceMutation();
  const [fetchInvoicePdf] = useLazyGetInvoicePdfQuery();
  const [updateInvoiceStatus] = useUpdateInvoiceStatusMutation();

  const [bookingIdForApproval, setBookingIdForApproval] = useState("");
  const [bookingIdForInvoice, setBookingIdForInvoice] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creditLimitInput, setCreditLimitInput] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const policyList = useMemo(() => (Array.isArray(policies) ? policies : []), [policies]);
  const memberList = useMemo(() => (Array.isArray(members) ? members : []), [members]);

  if (!hasHydrated || companiesLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] text-[var(--cyan)]">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <h1 className="fo-desk__title">Corporate travel</h1>
          </div>
          <p className="fo-desk__lede">
            Company credit, booking approvals, invoices, and travel policy. Sign in to open your
            company desk — server policy stays authoritative.
          </p>
          <div className="fo-desk__toolbar" style={{ marginTop: "0.25rem" }}>
            <Link href="/login?redirect=/corporate">
              <Button size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="secondary">
                Create account
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="ghost">
                Book with Ava
              </Button>
            </Link>
          </div>
        </header>

        <section className="fo-desk__panel" style={{ padding: 0 }}>
          <div className="fo-desk__row" style={{ padding: "0.85rem 1rem" }}>
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyan)]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">Credit & invoicing</p>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  Corporate credit limits, consolidated statements, and invoice PDFs.
                </p>
              </div>
            </div>
          </div>
          <div className="fo-desk__row" style={{ padding: "0.85rem 1rem" }}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyan)]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">Policy & approvals</p>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  Cabin and spend rules with manager approval queues before ticket.
                </p>
              </div>
            </div>
          </div>
          <div className="fo-desk__row" style={{ padding: "0.85rem 1rem" }}>
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyan)]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">Duty of care</p>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  Traveller visibility and disruption handling through FlightOne ops.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="fo-desk__panel fo-desk__stack">
          <DeskSectionHead icon={Lock} title="Company desk access" />
          <p className="text-sm text-[var(--ink-soft)]" style={{ margin: 0 }}>
            Switch company profiles, approve bookings, review ledgers, and download invoices after
            sign-in.
          </p>
          <div className="fo-desk__toolbar">
            <Link href="/login?redirect=/corporate">
              <Button size="sm">Log in to company account</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="ghost">
                Register company
              </Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
      <header className="fo-desk__header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] text-[var(--cyan)]">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
              <h1 className="fo-desk__title">Corporate travel</h1>
            </div>
            <p className="fo-desk__lede">
              Switch profile, review credit, approve bookings, and manage company settings. Server
              policy remains authoritative.
            </p>
          </div>
          {profile?.membership?.role ? (
            <DeskStatus tone={isAdmin ? "ok" : "neutral"}>{profile.membership.role}</DeskStatus>
          ) : null}
        </div>
      </header>

      <section className="fo-desk__profile">
        <p className="fo-desk__section-label">Active profile</p>
        <div className="fo-desk__toolbar">
          <button
            type="button"
            className={`fo-desk__chip${mode === "PERSONAL" ? " fo-desk__chip--active" : ""}`}
            onClick={() => {
              setPersonal();
              setMsg(null);
            }}
          >
            Personal
          </button>
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fo-desk__chip${
                mode === "CORPORATE" && activeCompanyId === c.id ? " fo-desk__chip--active" : ""
              }`}
              onClick={() => {
                setCorporate(c.id);
                setMsg(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        {profileLoading ? <Spinner /> : null}
        {profile ? (
          <div className="fo-desk__profile-facts">
            <p>
              Mode: <strong>{profile.mode}</strong>
              {profile.company ? ` · ${profile.company.name}` : ""}
              {profile.membership?.role ? ` · ${profile.membership.role}` : ""}
            </p>
            {profile.policy ? (
              <p>
                Policy: cabin {profile.policy.maxCabin || "—"} · max{" "}
                {money(profile.policy.maxAmountMinor ?? undefined, profile.company?.currency)} ·
                advance {profile.policy.advanceBookingDays ?? "—"}d
              </p>
            ) : profile.mode === "CORPORATE" ? (
              <p>No active travel policy configured.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {profile?.company ? (
        <div className="fo-desk__kpi-strip" aria-label="Company credit">
          <div className="fo-desk__kpi">
            <p className="fo-desk__kpi-label">Credit used</p>
            <p className="fo-desk__kpi-value">
              {money(profile.company.creditUsedMinor, profile.company.currency)}
            </p>
          </div>
          <div className="fo-desk__kpi">
            <p className="fo-desk__kpi-label">Available</p>
            <p className="fo-desk__kpi-value">
              {money(profile.company.creditAvailableMinor, profile.company.currency)}
            </p>
          </div>
          <div className="fo-desk__kpi">
            <p className="fo-desk__kpi-label">Limit</p>
            <p className="fo-desk__kpi-value">
              {money(profile.company.creditLimitMinor, profile.company.currency)}
            </p>
          </div>
          <div className="fo-desk__kpi">
            <p className="fo-desk__kpi-label">Pending approvals</p>
            <p className="fo-desk__kpi-value">
              {isApprover ? (approvals?.items?.length ?? 0) : "—"}
            </p>
            {!isApprover ? (
              <p className="fo-desk__kpi-note">Approver role required</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {companies.length === 0 ? (
        <section className="fo-desk__panel fo-desk__stack">
          <DeskSectionHead icon={Building2} title="Create company" />
          <p className="fo-desk__empty" style={{ padding: 0 }}>
            No company memberships yet. Create a company to become its ADMIN.
          </p>
          <Input
            label="Company name"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Acme Travel Desk"
          />
          <Button
            size="sm"
            type="button"
            disabled={!newCompanyName.trim()}
            onClick={async () => {
              setMsg(null);
              try {
                const c = await createCompany({ name: newCompanyName.trim() }).unwrap();
                setCorporate(c.id);
                setNewCompanyName("");
                setMsg(`Created ${c.name}`);
              } catch {
                setMsg("Could not create company.");
              }
            }}
          >
            Create company
          </Button>
        </section>
      ) : null}

      {activeCompanyId && isApprover ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <DeskSectionHead
            icon={ShieldCheck}
            title="Pending approvals"
            flush
            trailing={
              approvals?.items?.length ? (
                <DeskStatus tone="warn">{approvals.items.length}</DeskStatus>
              ) : null
            }
          />
          {!approvals?.items?.length ? (
            <p className="fo-desk__empty">No pending approvals.</p>
          ) : (
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.items.map((a) => (
                    <tr key={a.id}>
                      <td className="fo-desk__mono">{a.bookingId.slice(0, 10)}…</td>
                      <td>{money(a.amountMinor, a.currency)}</td>
                      <td>
                        <DeskStatus tone="warn">{a.status}</DeskStatus>
                      </td>
                      <td>
                        <div className="fo-desk__toolbar">
                          <Button
                            size="sm"
                            type="button"
                            onClick={async () => {
                              try {
                                await decide({ id: a.id, decision: "APPROVE" }).unwrap();
                                setMsg("Approved");
                              } catch {
                                setMsg("Approve failed");
                              }
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={async () => {
                              try {
                                await decide({ id: a.id, decision: "REJECT" }).unwrap();
                                setMsg("Rejected");
                              } catch {
                                setMsg("Reject failed");
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeCompanyId ? (
        <section className="fo-desk__panel fo-desk__stack">
          <DeskSectionHead icon={ClipboardList} title="Request approval" />
          <Input
            label="Booking ID"
            value={bookingIdForApproval}
            onChange={(e) => setBookingIdForApproval(e.target.value)}
            placeholder="From checkout or chat quote"
          />
          <Button
            size="sm"
            type="button"
            disabled={!bookingIdForApproval.trim()}
            onClick={async () => {
              setMsg(null);
              try {
                await createApproval({
                  bookingId: bookingIdForApproval.trim(),
                  companyId: activeCompanyId,
                }).unwrap();
                setBookingIdForApproval("");
                setMsg("Approval requested");
              } catch {
                setMsg("Could not create approval (check booking ownership / company).");
              }
            }}
          >
            Submit for approval
          </Button>
        </section>
      ) : null}

      {activeCompanyId ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <DeskSectionHead icon={FileText} title="Company bookings" flush />
          {!bookings?.items?.length ? (
            <p className="fo-desk__empty">No company bookings yet.</p>
          ) : (
            <>
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(bookings.items, bookingsPage, TABLE_PAGE_SIZE).map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link href={`/checkout/${b.id}`}>{b.id.slice(0, 10)}…</Link>
                        </td>
                        <td>
                          <DeskStatus>{b.status}</DeskStatus>
                        </td>
                        <td>{money(b.amountMinor, b.currency)}</td>
                        <td>{b.metadata?.projectCode || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={bookingsPage}
                pageCount={pageCountFor(bookings.items.length, TABLE_PAGE_SIZE)}
                onPageChange={setBookingsPage}
                totalItems={bookings.items.length}
                label="Company bookings"
              />
            </>
          )}
        </section>
      ) : null}

      {activeCompanyId ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <DeskSectionHead icon={CreditCard} title="Invoices" flush />
          {!invoices?.items?.length ? (
            <p className="fo-desk__empty">No invoices yet.</p>
          ) : (
            <>
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Booking</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(invoices.items, invoicesPage, TABLE_PAGE_SIZE).map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <span className="font-medium text-[var(--navy)]">{inv.invoiceNumber}</span>
                          {inv.projectCode ? (
                            <span className="text-[var(--ink-faint)]"> · {inv.projectCode}</span>
                          ) : null}
                          <div className="text-[11px] text-[var(--ink-faint)]">
                            {inv.issuedAt ? String(inv.issuedAt).slice(0, 10) : "—"}
                          </div>
                        </td>
                        <td>
                          <DeskStatus tone={invoiceTone(inv.status)}>{inv.status}</DeskStatus>
                        </td>
                        <td>{money(inv.amountMinor, inv.currency)}</td>
                        <td className="fo-desk__mono">{inv.bookingId.slice(0, 10)}…</td>
                        <td>
                          <div className="fo-desk__toolbar">
                            <Button
                              size="sm"
                              variant="secondary"
                              type="button"
                              onClick={async () => {
                                try {
                                  const pdf = await fetchInvoicePdf({
                                    companyId: activeCompanyId,
                                    invoiceId: inv.id,
                                  }).unwrap();
                                  const bin = atob(pdf.contentBase64);
                                  const bytes = new Uint8Array(bin.length);
                                  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                                  const blob = new Blob([bytes], {
                                    type: pdf.contentType || "application/pdf",
                                  });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = pdf.filename || `${inv.invoiceNumber}.pdf`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch {
                                  setMsg("Could not download invoice PDF");
                                }
                              }}
                            >
                              PDF
                            </Button>
                            {isAdmin && inv.status === "ISSUED" ? (
                              <Button
                                size="sm"
                                type="button"
                                onClick={async () => {
                                  try {
                                    await updateInvoiceStatus({
                                      companyId: activeCompanyId,
                                      invoiceId: inv.id,
                                      status: "PAID",
                                    }).unwrap();
                                    setMsg("Invoice marked paid");
                                  } catch {
                                    setMsg("Could not update invoice");
                                  }
                                }}
                              >
                                Mark paid
                              </Button>
                            ) : null}
                            {isAdmin && inv.status !== "VOID" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                type="button"
                                onClick={async () => {
                                  try {
                                    await updateInvoiceStatus({
                                      companyId: activeCompanyId,
                                      invoiceId: inv.id,
                                      status: "VOID",
                                    }).unwrap();
                                    setMsg("Invoice voided");
                                  } catch {
                                    setMsg("Could not void invoice");
                                  }
                                }}
                              >
                                Void
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={invoicesPage}
                pageCount={pageCountFor(invoices.items.length, TABLE_PAGE_SIZE)}
                onPageChange={setInvoicesPage}
                totalItems={invoices.items.length}
                label="Invoices"
              />
            </>
          )}
          {isAdmin ? (
            <div
              className="fo-desk__stack"
              style={{ padding: "0.85rem 1rem", borderTop: "1px solid var(--fo-desk-line)" }}
            >
              <Input
                label="Booking ID to invoice"
                value={bookingIdForInvoice}
                onChange={(e) => setBookingIdForInvoice(e.target.value)}
                placeholder="RESERVED / TICKETED booking id"
              />
              <Button
                size="sm"
                type="button"
                disabled={!bookingIdForInvoice.trim()}
                onClick={async () => {
                  setMsg(null);
                  try {
                    const inv = await issueInvoice({
                      companyId: activeCompanyId,
                      bookingId: bookingIdForInvoice.trim(),
                    }).unwrap();
                    setBookingIdForInvoice("");
                    setMsg(`Issued ${inv.invoiceNumber}`);
                  } catch {
                    setMsg("Could not issue invoice (check booking status / company).");
                  }
                }}
              >
                Issue invoice
              </Button>
            </div>
          ) : (
            <p className="fo-desk__empty">Only company ADMIN can issue invoices.</p>
          )}
        </section>
      ) : null}

      {activeCompanyId ? (
        <section className="fo-desk__panel fo-desk__stack">
          <DeskSectionHead icon={ScrollText} title="Travel policies" />
          {!policyList.length ? (
            <p className="fo-desk__empty" style={{ padding: 0 }}>
              No policies listed (ADMIN configures via API).
            </p>
          ) : (
            <div className="fo-desk__table-wrap -mx-1">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Cabin</th>
                    <th>Max amount</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {policyList.map((p) => (
                    <tr key={p.id}>
                      <td>{p.maxCabin || "—"}</td>
                      <td>{money(p.maxAmountMinor ?? undefined, profile?.company?.currency)}</td>
                      <td>
                        <DeskStatus tone={p.isActive === false ? "neutral" : "ok"}>
                          {p.isActive === false ? "inactive" : "active"}
                        </DeskStatus>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeCompanyId ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <DeskSectionHead icon={FolderKanban} title="Project codes" flush />
          {!projectCodes.length ? (
            <p className="fo-desk__empty">No project codes yet.</p>
          ) : (
            <div className="fo-desk__table-wrap">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>State</th>
                    {isAdmin ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {projectCodes.map((pc) => (
                    <tr key={pc.id}>
                      <td className="font-medium text-[var(--navy)]">{pc.code}</td>
                      <td>{pc.name}</td>
                      <td>
                        <DeskStatus tone={pc.isActive ? "ok" : "neutral"}>
                          {pc.isActive ? "active" : "inactive"}
                        </DeskStatus>
                      </td>
                      {isAdmin ? (
                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={async () => {
                              try {
                                await updateProjectCode({
                                  companyId: activeCompanyId,
                                  projectCodeId: pc.id,
                                  isActive: !pc.isActive,
                                }).unwrap();
                                setMsg(
                                  pc.isActive
                                    ? "Project code deactivated"
                                    : "Project code reactivated",
                                );
                              } catch {
                                setMsg("Could not update project code");
                              }
                            }}
                          >
                            {pc.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isAdmin ? (
            <div
              className="fo-desk__stack"
              style={{ padding: "0.85rem 1rem", borderTop: "1px solid var(--fo-desk-line)" }}
            >
              <Input
                label="Code"
                value={newProjectCode}
                onChange={(e) => setNewProjectCode(e.target.value)}
                placeholder="PROJ-1042"
              />
              <Input
                label="Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Q3 sales kickoff"
              />
              <Button
                size="sm"
                type="button"
                disabled={!newProjectCode.trim() || !newProjectName.trim()}
                onClick={async () => {
                  setMsg(null);
                  try {
                    await createProjectCode({
                      companyId: activeCompanyId,
                      code: newProjectCode.trim(),
                      name: newProjectName.trim(),
                    }).unwrap();
                    setNewProjectCode("");
                    setNewProjectName("");
                    setMsg("Project code created");
                  } catch {
                    setMsg("Could not create project code (check uniqueness / permissions).");
                  }
                }}
              >
                Add project code
              </Button>
            </div>
          ) : (
            <p className="fo-desk__empty">Only company ADMIN can manage project codes.</p>
          )}
        </section>
      ) : null}

      {activeCompanyId ? (
        <CorporatePortalSection companyId={activeCompanyId} isAdmin={isAdmin} />
      ) : null}

      {activeCompanyId ? (
        <CorporateExpensesSection
          companyId={activeCompanyId}
          isAdmin={isAdmin}
          isApprover={isApprover}
          bookings={bookings?.items || []}
        />
      ) : null}

      {activeCompanyId ? <CorporateCarbonSection companyId={activeCompanyId} /> : null}
      {activeCompanyId ? (
        <CorporateAnalyticsSection companyId={activeCompanyId} canRead={isAdmin || isApprover} />
      ) : null}

      {activeCompanyId && isAdmin ? (
        <section className="fo-desk__panel fo-desk__stack">
          <DeskSectionHead icon={Users} title="Admin — credit & members" />
          <PermissionGate
            anyOf={["corporate:company:write"]}
            companyId={activeCompanyId}
            mode="fallback"
            fallback={
              <p className="text-[13px] text-[var(--ink-soft)]" style={{ margin: 0 }}>
                Credit limit changes require `corporate:company:write`. Company ADMIN can still
                manage members below.
              </p>
            }
          >
            <Input
              label="New credit limit (minor units)"
              value={creditLimitInput}
              onChange={(e) => setCreditLimitInput(e.target.value)}
              placeholder={String(profile?.company?.creditLimitMinor ?? "")}
            />
            <Button
              size="sm"
              type="button"
              disabled={!creditLimitInput.trim()}
              onClick={async () => {
                const n = Number(creditLimitInput);
                if (!Number.isFinite(n) || n < 0) {
                  setMsg("Invalid credit limit");
                  return;
                }
                try {
                  await updateCompany({
                    id: activeCompanyId,
                    creditLimitMinor: Math.round(n),
                  }).unwrap();
                  setMsg("Credit limit updated");
                } catch {
                  setMsg("Credit update failed (permission or cannot go below used).");
                }
              }}
            >
              Update credit limit
            </Button>
          </PermissionGate>
          <div>
            <p className="fo-desk__section-label" style={{ marginBottom: "0.5rem" }}>
              Members
            </p>
            {!memberList.length ? (
              <p className="fo-desk__empty" style={{ padding: 0 }}>
                No members returned.
              </p>
            ) : (
              <div className="fo-desk__table-wrap -mx-1">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberList.map((m) => (
                      <tr key={m.userId}>
                        <td>
                          {m.traveller?.displayName ||
                            m.traveller?.name ||
                            m.traveller?.email ||
                            m.userId.slice(0, 8)}
                        </td>
                        <td>
                          <DeskStatus tone={m.role === "ADMIN" ? "ok" : "neutral"}>
                            {m.role}
                          </DeskStatus>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeCompanyId && isAdmin ? (
        <section className="fo-desk__panel fo-desk__panel--flush">
          <DeskSectionHead icon={ScrollText} title="Company audit" flush />
          {!audit?.items?.length ? (
            <p className="fo-desk__empty">No audit entries yet.</p>
          ) : (
            <>
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Resource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginateItems(audit.items, auditPage, TABLE_PAGE_SIZE).map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.createdAt).toLocaleString()}</td>
                        <td>{a.action}</td>
                        <td>{a.resourceType || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={auditPage}
                pageCount={pageCountFor(audit.items.length, TABLE_PAGE_SIZE)}
                onPageChange={setAuditPage}
                totalItems={audit.items.length}
                label="Company audit"
              />
            </>
          )}
        </section>
      ) : null}

      <MsgLine msg={msg} />
    </div>
  );
}
