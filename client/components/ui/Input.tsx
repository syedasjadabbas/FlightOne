"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  allowTogglePassword?: boolean;
}

/** Standard labeled field. `error` wins over `hint` if both are passed. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, type, allowTogglePassword = true, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="cursor-pointer text-[13px] font-medium text-ink-soft">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={fieldId}
          type={inputType}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(
            "w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition-colors duration-200",
            "placeholder:text-ink-faint",
            "focus-visible:ring-2 focus-visible:ring-[var(--sky)]/35",
            error
              ? "border-[var(--danger)] focus-visible:border-[var(--danger)]"
              : "border-line focus-visible:border-[var(--sky)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isPassword && allowTogglePassword ? "pr-10" : "",
            className,
          )}
          {...rest}
        />
        {isPassword && allowTogglePassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            className="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:text-ink focus:outline-none transition-colors"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .698 10.793 10.793 0 0 1-3.125 4.385" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.698 10.748 10.748 0 0 1 5.344-4.787" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="text-[12px] font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-[12px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
