import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { SiteChromeFooter } from "@/components/SiteChromeFooter";

type DeskShellProps = {
  children: ReactNode;
  /** Wide ops / dashboard canvas (fo-desk-shell path). */
  wide?: boolean;
  /** Checkout column width. */
  checkout?: boolean;
  /**
   * Groups / MICE path: fo-gm + fo-gm__canvas (not fo-desk-shell).
   */
  canvas?: boolean;
  canvasWide?: boolean;
  className?: string;
  /** Omit light page footer (rare). */
  hideFooter?: boolean;
};

/**
 * Shared desk page frame — content column + light SiteChromeFooter.
 */
export function DeskShell({
  children,
  wide = false,
  checkout = false,
  canvas = false,
  canvasWide = false,
  className,
  hideFooter = false,
}: DeskShellProps) {
  if (canvas) {
    return (
      <>
        <div className={cn("fo-gm", className)}>
          <div
            className={cn(
              "fo-gm__canvas",
              canvasWide && "fo-gm__canvas--wide",
            )}
          >
            {children}
          </div>
        </div>
        {hideFooter ? null : <SiteChromeFooter />}
      </>
    );
  }

  return (
    <>
      <div className={cn("fo-desk-shell", className)}>
        <div
          className={cn(
            "fo-desk",
            wide && "fo-desk--wide",
            checkout && "fo-desk--checkout",
          )}
        >
          {children}
        </div>
      </div>
      {hideFooter ? null : <SiteChromeFooter />}
    </>
  );
}
