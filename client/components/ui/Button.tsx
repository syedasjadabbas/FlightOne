import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "cyan";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border border-white/15 bg-[#0e1620] text-white shadow-[0_4px_14px_rgba(14,22,32,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#020615] hover:shadow-[0_8px_22px_rgba(14,22,32,0.32)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  dark:
    "border border-white/15 bg-[#0e1620] text-white shadow-[0_4px_14px_rgba(14,22,32,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#020615] hover:shadow-[0_8px_22px_rgba(14,22,32,0.32)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  secondary:
    "border border-black/10 bg-white/85 text-[#0e1620] shadow-[0_2px_8px_rgba(14,22,32,0.04),inset_0_1px_0_#ffffff] backdrop-blur-md hover:bg-white hover:border-black/20 hover:shadow-[0_6px_16px_rgba(14,22,32,0.08)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  ghost:
    "border border-transparent text-[#55606e] hover:text-[#0e1620] hover:bg-black/[0.05] active:bg-black/[0.09] active:scale-[0.98]",
  danger:
    "border border-[var(--danger)]/20 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/18 hover:border-[var(--danger)]/30 hover:-translate-y-[0.5px] active:translate-y-0 active:scale-[0.98]",
  cyan:
    "border border-transparent bg-[var(--sky-solid)] text-white shadow-[0_4px_14px_rgba(8,150,191,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-[color-mix(in_oklab,var(--electric)_90%,var(--navy))] hover:shadow-[0_8px_22px_rgba(0,122,229,0.4)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
};

/**
 * Blanket `opacity-40` fades the label and its fill together, so contrast
 * collapses: white-on-navy lands at 2.56:1, ghost at 1.85:1, cyan at 1.75:1 —
 * all below the 3:1 floor. A flat neutral slab reads as a deliberate state
 * instead of broken text, and holds the label at 5.42:1. Same treatment as
 * `.filter-smart-apply:disabled` in globals.css.
 *
 * `#ececed` is `color-mix(in oklab, var(--navy) 7%, var(--white))` pre-resolved.
 * Written literally on purpose: Tailwind compiles an arbitrary `color-mix()`
 * value with a `background-color: var(--navy)` fallback for browsers without
 * `color-mix(in lab)` support, which would put --ink-soft text on solid navy —
 * worse than the bug being fixed.
 *
 * Both forms below are spelled out literally rather than derived at runtime:
 * Tailwind extracts class candidates from source text, so a template-built
 * string would never be generated.
 *
 * This is the `:disabled` pseudo-class form — it beats the variant utilities on
 * specificity.
 */
const DISABLED_ATTR_CLASS =
  "disabled:cursor-not-allowed disabled:border-black/[0.06] disabled:bg-[#ececed] disabled:text-[var(--ink-soft)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100";

/**
 * Bare form, for callers that pass `disabled` to `buttonClassName` on an element
 * with no native `:disabled` state (e.g. an anchor). `!` is required here:
 * without the pseudo-class these tie with the variant utilities on specificity
 * and would otherwise lose on source order.
 */
const DISABLED_PROP_CLASS =
  "cursor-not-allowed border-black/[0.06]! bg-[#ececed]! text-[var(--ink-soft)]! shadow-none! hover:translate-y-0 hover:shadow-none active:scale-100";

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-9 rounded-full px-4 text-[13px] font-semibold tracking-[0.01em]",
  md: "h-10 rounded-full px-5 text-[14px] font-semibold tracking-[0.01em]",
  lg: "h-12 rounded-full px-7 text-[15px] font-semibold tracking-[0.01em]",
  icon: "h-9 w-9 rounded-full p-0 flex items-center justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function buttonClassName({
  variant = "primary",
  size = "md",
  disabled,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-1.5 font-semibold transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
    DISABLED_ATTR_CLASS,
    disabled && DISABLED_PROP_CLASS,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    className,
    type = "button",
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={buttonClassName({ variant, size, disabled, className })}
      {...props}
    >
      {icon && (
        <span className="inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center">{icon}</span>
      )}
      {children}
    </button>
  );
});
