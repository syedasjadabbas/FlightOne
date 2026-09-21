import type { ReactNode } from "react";
import "../styles/flightone-visual.css";
import "./auth-shell.css";

/**
 * Auth routes — SiteNav visual + fo-auth shell only (no chat/ops CSS).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
