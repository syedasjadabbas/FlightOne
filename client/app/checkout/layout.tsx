import type { ReactNode } from "react";
import "../styles/flightone-visual.css";
import "../styles/flightone-desk.css";
import "../styles/flightone-ui.css";
// Must come last: checkout-scoped overrides of the shared desk chrome above.
import "./checkout.css";

/** Shared desk chrome CSS for corporate / ops / dashboard / checkout. */
export default function DeskChromeLayout({ children }: { children: ReactNode }) {
  return children;
}
