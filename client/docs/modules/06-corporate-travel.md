# Module 06 — Corporate Travel

**PRD Module 6** · Prefix: `CORP` · Phase: 1 (approvals/credit) → 3 (white-label portals,
expense management)

**Status: MODULE 6 COMPLETE** (Phase 1 in-scope). Items below marked deferred are
PRD Phase 2/3 or cross-module dependencies — not open Module 6 implementation stages.

## Objective (from PRD)

Support multiple companies, departments, cost centres, travel policies, approval
workflows, credit limits, billing cycles, corporate invoicing, budget enforcement, and
project codes — with travellers able to switch between Corporate and Personal profiles
while keeping payment methods and booking history separate.

## Dependencies

- Module 00 (tenancy/profile-switch model)
- Module 03 (approval gate before payment capture)
- Module 05 (corporate-specific pricing)

## Core concepts

- A **company** is a tenant with its own policies and credit terms; a traveller can belong
  to multiple companies.
- **Corporate vs Personal is a profile switch, not a separate account** (dev guide §3).
- Approval/budget checks happen **before** supplier reservation (dev guide §7).
- **Policy evaluation is not approval.** `evaluatePolicy` is deterministic; bookings still
  require an `APPROVED` ApprovalRequest before pay/reserve (within-policy requests may be
  auto-APPROVED when created).

## Phase 1 checklist (complete)

### Company structure
- [x] Company entity: name, credit terms, currency, active status, billingCycle string
- [x] Company ADMIN update of credit/markup/billing/active (`PATCH /companies/:id`)
- [x] Project codes (company-scoped create/list/update/deactivate; optional booking association)
- [x] Corporate invoicing (issue from authoritative booking; list/get/PDF; ISSUED/PAID/VOID)

### Policy & approval
- [x] Travel policy definition (cabin, max fare, preferred airlines, advance window)
- [x] Policy CRUD (create/list/update) — ADMIN only
- [x] Policy violation detection at quote (`metadata.policyEvaluation`) + evaluate-policy API
- [x] Approval workflow: REQUIRED → PENDING → APPROVED/REJECTED (`getBookingApprovalGate`)
- [x] Approval decision (approve/reject/request-changes) blocks or releases booking

### Financial controls
- [x] Credit limit per company (`creditLimitMinor` / `creditUsedMinor`), checked pre-reserve
- [x] Credit consume on RESERVE + idempotent release on CANCELLED/REFUNDED
      (`releaseCreditForBooking`; stamps `metadata.corporateCredit`)
- [x] Company ADMIN may raise/lower credit limit (cannot go below used)
- [x] Real-time credit balance on company + active-profile + company bookings list
- [x] Optional `Company.markupBps` → Module 05 `companyMarkupBps` (no double markup)

### Membership & profile
- [x] Add / update / remove members with MEMBER|APPROVER|ADMIN (ADMIN-gated)
- [x] TravellerProfile summary on member list (Module 02 reuse)
- [x] Server-validated Personal ↔ Corporate `active-profile`
- [x] Entitlements re-resolved on profile switch (membership-checked companyId)
- [x] Company booking visibility (`listCompanyBookings`)
- [x] Admin audit trail (`AuditLog` via `listCompanyAudit`)
- [x] Ava soft corporate constraints (server policy remains authoritative)
- [x] Module 03 pay / reserve / ticket gated by `assertCorporateBookingAllowed`
- [x] Guests blocked (`requireAuth`); client `companyId` never trusted

## PRD-deferred / cross-module (not Module 6 follow-up stages)

| Item | Reason |
| --- | --- |
| Department / cost-centre **entities** | PRD-deferred — membership free-text fields only in Phase 1 |
| Approver-per-dept / OOO multi-step approvals | PRD-deferred — single-step APPROVER/ADMIN |
| Negotiated rate **tables** | Cross-module / undefined data model — `markupBps` hook only |
| Recurring/automated billing engine | PRD-deferred — `billingCycle` is informational on invoices |
| Dept/project budgets | PRD-deferred — company credit only |
| Full payment vault isolation per profile | PRD-deferred — `corporate_credit` vs card path exists |
| Personal/corporate booking history UI split | PRD-deferred — `metadata.companyId` + `listCompanyBookings` |
| White-label portals / expense / carbon | Phase 3 |
| Module 17 analytics | Out of scope |

## Business rules / invariants

- No corporate booking reaches payment capture without passing the policy/approval/credit
  gate for its company.
- Credit-limit checks are server-side and re-evaluated at booking time.
- Guests cannot access `/api/v1/corporate/*`.
- Client-supplied `companyId` is verified via membership before quote/profile resolution.
