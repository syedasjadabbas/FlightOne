import type { ReactNode } from "react";
import { BrandMark } from "@/app/components/chat/BrandMark";
import { cn } from "@/utils/cn";

type AuthPanelProps = {
  title: string;
  lead?: ReactNode;
  /** ARIA role for the lead (e.g. status / alert on outcome screens). */
  leadRole?: "status" | "alert";
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Auth form surface — FlightOne wordmark + cyan route rail as the signature,
 * Sora title for the single job. Not a generic SaaS card.
 */
export function AuthPanel({
  title,
  lead,
  leadRole,
  children,
  footer,
  className,
}: AuthPanelProps) {
  return (
    <div className={cn("fo-auth__panel anim-fade", className)}>
      <div className="fo-auth__brand">
        <span className="fo-auth__brand-badge">
          <span className="fo-auth__brand-dot" aria-hidden />
          Account
        </span>
        <BrandMark size="compact" />
        <span className="fo-auth__route" aria-hidden />
      </div>
      <h1 className="fo-auth__title">{title}</h1>
      {lead ? (
        <p className="fo-auth__lead" role={leadRole}>
          {lead}
        </p>
      ) : null}
      {children ? <div className="fo-auth__body">{children}</div> : null}
      {footer ? <div className="fo-auth__footer">{footer}</div> : null}
    </div>
  );
}
