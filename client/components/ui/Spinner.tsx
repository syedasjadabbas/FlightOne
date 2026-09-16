import { cn } from "@/utils/cn";

export type SpinnerSize = "sm" | "md";

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[2.5px]",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /**
   * Screen-reader label; visually hidden. Pass `null` when the spinner is
   * decorative (e.g. inside a Button that already announces pending copy).
   */
  label?: string | null;
}

/**
 * Loading indicator (docs/design/components.md#spinner) for ordinary async
 * UI (button pending state, page-level loads). The chat "Charting" state
 * has its own richer `TypingDots` — this is the plain, everywhere primitive.
 * Respects `prefers-reduced-motion` via `motion-reduce:animate-none`.
 */
export function Spinner({ size = "md", className, label = "Loading" }: SpinnerProps) {
  const announce = Boolean(label);
  return (
    <span
      role={announce ? "status" : undefined}
      aria-hidden={announce ? undefined : true}
      className={cn(
        "inline-block animate-spin motion-reduce:animate-none rounded-full border-solid border-signal/25 border-t-signal",
        SIZE_CLASS[size],
        className,
      )}
    >
      {announce ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
