export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const u = status.toUpperCase();
  const isOk = u === "OK" || u === "AVAILABLE";
  const isWarn = u.includes("UNCONFIG") || u.includes("NO_DATA") || u.includes("UNAVAILABLE");

  const badgeClass = isOk
    ? "fo-dash__status-badge fo-dash__status-badge--ok"
    : isWarn
      ? "fo-dash__status-badge fo-dash__status-badge--warn"
      : "fo-dash__status-badge fo-dash__status-badge--neutral";

  return (
    <span className={badgeClass}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-sm"
        style={{
          background: isOk ? "var(--cyan)" : isWarn ? "var(--electric)" : "var(--fo-desk-muted)",
        }}
        aria-hidden
      />
      {status}
    </span>
  );
}
