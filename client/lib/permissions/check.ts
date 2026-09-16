/**
 * Client-side permission helpers (UX only — server remains authoritative).
 * Uses the same `{ global, byCompany }` shape as GET /me/permissions.
 */

export type EffectivePermissions = {
  global: string[];
  byCompany: Record<string, string[]>;
};

export function hasPermissionKey(
  perms: EffectivePermissions | null | undefined,
  key: string,
  companyId?: string | null,
): boolean {
  if (!perms || !key) return false;
  if (perms.global?.includes(key)) return true;
  if (companyId) {
    return Boolean(perms.byCompany?.[companyId]?.includes(key));
  }
  for (const keys of Object.values(perms.byCompany || {})) {
    if (keys?.includes(key)) return true;
  }
  return false;
}

export function hasAnyPermission(
  perms: EffectivePermissions | null | undefined,
  keys: string[],
  companyId?: string | null,
): boolean {
  return keys.some((k) => hasPermissionKey(perms, k, companyId));
}

export function hasAllPermissions(
  perms: EffectivePermissions | null | undefined,
  keys: string[],
  companyId?: string | null,
): boolean {
  if (!keys.length) return false;
  return keys.every((k) => hasPermissionKey(perms, k, companyId));
}
