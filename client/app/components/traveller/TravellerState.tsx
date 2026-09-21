import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function TravellerState({
  variant = "empty",
  title,
  children,
  action,
  className,
}: {
  variant?: "empty" | "error";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fo-traveller__state",
        variant === "error" && "fo-traveller__state--error",
        className,
      )}
      role={variant === "error" ? "alert" : undefined}
    >
      <p className="fo-traveller__state-title">{title}</p>
      {children ? <div className="fo-traveller__state-body">{children}</div> : null}
      {action ? <div className="fo-traveller__state-action">{action}</div> : null}
    </div>
  );
}

export function TravellerChip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "warn" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "fo-traveller__chip",
        tone === "warn" && "fo-traveller__chip--warn",
        tone === "muted" && "fo-traveller__chip--muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
