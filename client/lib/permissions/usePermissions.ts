"use client";

import { useGetMyPermissionsQuery } from "@/lib/api/escalations.api";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermissionKey,
  type EffectivePermissions,
} from "@/lib/permissions/check";
import { useAuthStore } from "@/store/auth.store";

/**
 * Centralized permission query for UX gating.
 * Does not replace Zustand auth — only reads /me/permissions via RTK.
 */
export function usePermissions() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data, isLoading, isError, refetch } = useGetMyPermissionsQuery(undefined, { skip });
  const perms = (data as EffectivePermissions | undefined) ?? null;

  return {
    hasHydrated,
    accessToken,
    isAuthenticated: Boolean(hasHydrated && accessToken),
    perms,
    isLoading: !hasHydrated || (!skip && isLoading),
    isError,
    refetch,
    has: (key: string, companyId?: string | null) => hasPermissionKey(perms, key, companyId),
    hasAny: (keys: string[], companyId?: string | null) =>
      hasAnyPermission(perms, keys, companyId),
    hasAll: (keys: string[], companyId?: string | null) =>
      hasAllPermissions(perms, keys, companyId),
  };
}
