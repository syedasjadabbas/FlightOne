/** Lightweight placeholder while a route client chunk loads. */
export function RouteChunkFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-2 py-16"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--electric)]"
        aria-hidden
      />
      <p className="text-xs font-medium text-[var(--ink-faint)]">{label}</p>
    </div>
  );
}
