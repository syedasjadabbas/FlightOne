import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export type SurfacePadding = "none" | "sm" | "md" | "lg";
export type SurfaceTag = "div" | "section" | "article" | "aside" | "li";

const PADDING_CLASS: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export interface SurfaceProps {
  children: ReactNode;
  padding?: SurfacePadding;
  /** Adds the offer-card hover lift — only for surfaces that are themselves clickable. */
  interactive?: boolean;
  className?: string;
  as?: SurfaceTag;
}

/**
 * Premium panel for interactive content (forms, offers, status cards).
 * Prefer flat text on the page background for static copy.
 */
export function Surface({ children, padding = "md", interactive, className, as: Tag = "div" }: SurfaceProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line bg-white",
        interactive && "offer-surface cursor-pointer",
        PADDING_CLASS[padding],
        className,
      )}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </Tag>
  );
}
