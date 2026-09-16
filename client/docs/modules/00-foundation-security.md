# Module 00 — Foundation & Security

**Not a numbered PRD module** — added the same way the sister ERP docs add
`01-foundation-security.md`: cross-cutting infrastructure every other module depends on.
Prefix: `FND` / `SEC`. Phase: 1 (must exist before any other module can ship safely).

## Objective

Identity, authentication, authorization/entitlements, tenancy (personal vs corporate), and
the security posture (encryption, secrets, PII handling) that every other module builds on.
None of the PRD's 17 modules can be responsibly shipped without this existing first.

## Core concepts

- One **identity** per person; a **profile switch** (Personal ↔ Corporate, see Module 06)
  changes context, not identity.
- **Entitlements**, not roles alone: `resource:action` keys (`booking:create`,
  `corporate:approvals:write`, `vault:document:read`) resolved per user, optionally scoped
  `byCompany` for corporate travellers.
- Every credential/document field in Module 02/07 (passport numbers, CNIC, payment tokens)
  is **PII/PCI-adjacent** — foundation defines the encryption-at-rest and access-logging
  rules those modules inherit, rather than each module reinventing them.

## Checklist

### Identity & authentication
- [ ] User registration (email/phone, OTP or password) with verification
- [x] JWT access + refresh token issuance on login
- [x] Refresh-token rotation + revocation (logout, "log out all devices" / revoke others)
- [ ] Session mirrored to secure cookie for the Next.js `proxy.ts` gate
- [ ] Social/SSO login (if required by product) behind the same identity model
- [ ] Corporate SSO (SAML/OIDC) for enterprise accounts (Module 06 dependency)
- [x] Account recovery (forgot password via hashed single-use token + email outbox; OTP re-verification deferred)
- [x] Device/session list + "sign out this device" (refresh-token sessions; revoke one / revoke others)

### Authorization & entitlements
- [ ] `resource:action` permission model, `/me/permissions` endpoint returning
      `{ global, byCompany }`
- [ ] Role → entitlement mapping, editable by company admins for their own company
      (Module 06), by platform admins globally
- [ ] Server-side enforcement on every endpoint (never trust the client-side `has()` check)
- [ ] `AuthGuard` / `PermissionGate` client primitives (defense in depth only)

### Tenancy / profile model
- [ ] Personal profile (default) vs Corporate profile(s) — a user can belong to multiple
      companies with different entitlements in each
- [ ] Active-profile switch persisted client-side (Zustand) and validated server-side on
      every request that's profile-scoped
- [ ] Data isolation: corporate bookings/documents never leak into personal views and vice
      versa

### Security posture
- [ ] Encryption at rest for identity documents (passport, CNIC, visa numbers) — field-level
      encryption, not just disk-level
- [ ] Encryption in transit (TLS everywhere, including service-to-service and supplier
      calls)
- [ ] Secrets management (supplier API keys, payment gateway keys) via a vault/secret
      manager, never committed or hardcoded
- [ ] PCI-scope isolation: card data touches only the payment gateway/tokenization flow,
      never stored raw in the platform DB
- [ ] Rate limiting + brute-force protection on auth endpoints
- [x] Audit log of security-sensitive actions (login success/failure, session create/revoke, password reset, permission change, document access) —
      immutable, append-only (feeds Module 15's audit requirements)
- [ ] Data-retention & deletion policy for PII (account closure, "right to be forgotten"
      where applicable)

## Business rules / invariants

- Every other module's endpoints assume an authenticated identity + resolved entitlements
  are already available (middleware-injected) — modules should not reimplement auth.
- Server is always the authority on entitlements; a client-side permission check is UX only.
- No module stores raw payment-card data — always via the payment gateway's tokenized
  reference (dependency for Module 03/05/06).
