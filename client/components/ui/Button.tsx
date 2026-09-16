import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-[var(--sky)] text-white hover:bg-[var(--electric)]",
  secondary:
    "border border-line bg-white text-ink hover:border-[color-mix(in_oklab,var(--sky)_45%,var(--line))] hover:bg-[var(--light)]",
  ghost: "text-ink-soft hover:bg-[var(--light)] hover:text-ink",
  danger:
    "bg-[color-mix(in_oklab,var(--danger)_12%,white)] text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_18%,white)]",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 rounded-full px-3.5 text-[13px]",
  md: "h-10 rounded-full px-5 text-[15px]",
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
    "inline-flex cursor-pointer items-center justify-center gap-1.5 font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:cursor-not-allowed disabled:opacity-40",
    disabled && "cursor-not-allowed opacity-40",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
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
