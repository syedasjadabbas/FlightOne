"use client";

import type { ReactNode } from "react";
import { Surface } from "@/components/ui";
import { usePermissions } from "@/lib/permissions/usePermissions";

export type PermissionGateProps = {
  /** Grant if the user has ANY of these keys. */
  anyOf?: string[];
  /** Grant if the user has ALL of these keys. */
  allOf?: string[];
  /** Optional company scope for company-assigned permissions. */
  companyId?: string | null;
  children: ReactNode;
  /** When denied: hide children (default) or show fallback / deny UI. */
  mode?: "hide" | "fallback";
  fallback?: ReactNode;
  /** Shown while permissions are loading (default: null). */
  loading?: ReactNode;
};

function DefaultDenied({ keys }: { keys: string[] }) {
  return (
    <Surface padding="md" className="space-y-2">
      <p className="text-[14px] font-medium text-ink">Access denied</p>
      <p className="text-[13px] text-ink-soft">
        Missing permission{keys.length > 1 ? "s" : ""}:{" "}
        <code className="text-[12px]">{keys.join(" / ")}</code>
      </p>
    </Surface>
  );
}

/**
 * UX-only permission gate. Server authorization remains authoritative.
 */
export function PermissionGate({
  anyOf,
  allOf,
  companyId,
  children,
  mode = "hide",
  fallback,
  loading = null,
}: PermissionGateProps) {
  const { isLoading, isAuthenticated, hasAny, hasAll } = usePermissions();

  if (isLoading) return <>{loading}</>;
  if (!isAuthenticated) {
    if (mode === "fallback") {
      return <>{fallback ?? <DefaultDenied keys={allOf?.length ? allOf : anyOf || []} />}</>;
    }
    return null;
  }

  const keys = allOf?.length ? allOf : anyOf || [];
  const allowed = allOf?.length
    ? hasAll(allOf, companyId)
    : anyOf?.length
      ? hasAny(anyOf, companyId)
      : false;

  if (allowed) return <>{children}</>;

  if (mode === "fallback") {
    return <>{fallback ?? <DefaultDenied keys={keys} />}</>;
  }
  return null;
}
