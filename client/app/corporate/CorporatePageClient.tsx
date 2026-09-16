"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const TABLE_PAGE_SIZE = 10;

function money(minor: number | undefined, currency?: string | null) {
  if (minor == null) return "—";
  return `${currency || ""} ${(minor / 100).toFixed(2)}`.trim();
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
      <div className="fo-desk__panel fo-desk__stack">
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Sign in to manage corporate travel.
        </p>
        <Link href="/login?redirect=/corporate" className="text-[14px] text-[var(--cyan)] underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
      <header className="fo-desk__header">
        <h1 className="fo-desk__title">Corporate travel</h1>
        <p className="fo-desk__lede">
          Switch profile, review credit, approve bookings, and manage company settings. Server policy
          remains authoritative.
        </p>
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
            {profile.company ? (
              <p>
                Credit{" "}
                <strong>
                  {money(profile.company.creditUsedMinor, profile.company.currency)}
                </strong>{" "}
                used / {money(profile.company.creditLimitMinor, profile.company.currency)} · available{" "}
                <strong>
                  {money(profile.company.creditAvailableMinor, profile.company.currency)}
                </strong>
              </p>
            ) : null}
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

      {companies.length === 0 ? (
        <section className="fo-desk__panel fo-desk__stack">
          <h2 className="fo-desk__section-label">Create company</h2>
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
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">Pending approvals</h2>
            {approvals?.items?.length ? (
              <span className="fo-desk__status fo-desk__status--warn">{approvals.items.length}</span>
            ) : null}
          </div>
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
                      <td>{a.status}</td>
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
          <h2 className="fo-desk__section-label">Request approval</h2>
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
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">Company bookings</h2>
          </div>
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
                        <td>{b.status}</td>
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
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">Invoices</h2>
          </div>
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
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        {inv.projectCode ? (
                          <span className="text-ink-faint"> · {inv.projectCode}</span>
                        ) : null}
                        <div className="text-[11px] text-ink-faint">
                          {inv.issuedAt ? String(inv.issuedAt).slice(0, 10) : "—"}
                        </div>
                      </td>
                      <td>{inv.status}</td>
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
            <div className="fo-desk__stack" style={{ padding: "0.85rem 1rem", borderTop: "1px solid var(--fo-desk-line)" }}>
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
          <h2 className="fo-desk__section-label">Travel policies</h2>
          {!policyList.length ? (
            <p className="fo-desk__empty" style={{ padding: 0 }}>
              No policies listed (ADMIN configures via API).
            </p>
          ) : (
            <div className="fo-desk__table-wrap">
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
                      <td>{p.isActive === false ? "inactive" : "active"}</td>
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
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">Project codes</h2>
          </div>
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
                      <td className="font-medium">{pc.code}</td>
                      <td>{pc.name}</td>
                      <td>{pc.isActive ? "active" : "inactive"}</td>
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
            <div className="fo-desk__stack" style={{ padding: "0.85rem 1rem", borderTop: "1px solid var(--fo-desk-line)" }}>
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

      {activeCompanyId && isAdmin ? (
        <section className="fo-desk__panel fo-desk__stack">
          <h2 className="fo-desk__section-label">Admin — credit & members</h2>
          <PermissionGate
            anyOf={["corporate:company:write"]}
            companyId={activeCompanyId}
            mode="fallback"
            fallback={
              <p className="text-[13px] text-ink-soft">
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
              <div className="fo-desk__table-wrap">
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
                        <td>{m.role}</td>
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
          <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
            <h2 className="fo-desk__section-label">Company audit</h2>
          </div>
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

      {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}
    </div>
  );
}
