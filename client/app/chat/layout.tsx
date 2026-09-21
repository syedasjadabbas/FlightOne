import type { ReactNode } from "react";
import "../styles/flightone-visual.css";
import "../styles/flightone-platform.css";
import "../styles/flightone-chat-layout.css";
import "../styles/flightone-chat-responsive.css";
import "../styles/flightone-chat-landing.css";
import "../styles/flightone-results-responsive.css";

/**
 * Chat-only CSS — keep chat / results / platform styles off landing & auth.
 */
export default function ChatRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
