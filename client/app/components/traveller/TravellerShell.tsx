import type { ReactNode } from "react";
import { SiteChromeFooter } from "@/components/SiteChromeFooter";
import { cn } from "@/utils/cn";
import "@/app/styles/flightone-visual.css";
import "@/app/styles/flightone-traveller.css";
import "@/app/styles/flightone-ui.css";

type TravellerShellWidth = "default" | "narrow" | "wide" | "full";

const WIDTH_CLASS: Record<TravellerShellWidth, string> = {
  default: "",
  narrow: "fo-traveller--narrow",
  wide: "fo-traveller--wide",
  full: "fo-traveller--full",
};

/**
 * Shared page frame for traveller module routes (SiteNav already rendered above).
 */
export function TravellerShell({
  children,
  width = "default",
  className,
  hideFooter = false,
}: {
  children: ReactNode;
  width?: TravellerShellWidth;
  className?: string;
  /** Omit light page footer (rare). */
  hideFooter?: boolean;
}) {
  return (
    <>
      <div className={cn("fo-traveller", WIDTH_CLASS[width], className)}>
        <div className="fo-traveller__inner">{children}</div>
      </div>
      {hideFooter ? null : <SiteChromeFooter />}
    </>
  );
}
