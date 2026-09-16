/**
 * Module 15 — Operations Platform
 *
 * Integration/operations layer only (not ERP/CRM rebuild, not Module 17 analytics).
 *
 * PRD integrations:
 * 1. CRM — adapter via OPS_CRM_BASE_URL + OPS_CRM_API_KEY (optional OPS_CRM_EVENTS_PATH, OPS_CRM_VERIFY)
 * 2. Mid office — OPS_MIDOFFICE_BASE_URL + OPS_MIDOFFICE_API_KEY
 * 3. Back office — OPS_BACKOFFICE_BASE_URL + OPS_BACKOFFICE_API_KEY
 * 4. Accounting — internal AccountingEntry ledger + optional OPS_ACCOUNTING_* external push
 * 5. Finance — reads Payment / RefundCase / AccountingEntry
 * 6. Commission — only when OPS_COMMISSION_BPS or PricingConfig ops_commission_bps is set
 * 7. Supplier reconciliation — booking net vs provided invoicedMinor (never fabricates invoices)
 * 8. Audit — reuses AuditLog via writeAudit; ops drain/reconcile/retry append events
 *
 * API: /api/v1/operations/*
 * UI: /ops (ops:dashboard:read); writes need ops:reconcile:write for reconcile/retry
 */
