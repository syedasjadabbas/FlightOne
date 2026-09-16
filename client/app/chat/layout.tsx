"use client";

/**
 * Client wrapper for /chat — active-chat document lock is toggled by ChatLayout
 * when the user sends their first message (fo-chat-active on html/body).
 */
export default function ChatRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
