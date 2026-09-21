import { Suspense } from "react";
import { ChatConsole } from "@/app/components/ChatConsole";
import { SiteNav } from "@/components/SiteNav";

export const metadata = {
  title: "FlightOne — Travel Consultant",
  description:
    "Describe your trip in plain language. FlightOne searches live flights and stays, then presents clear options to compare.",
};

/** Module 01 — Ask AI (chat + live results rail). */
export default function ChatPage() {
  return (
    <main className="fo-stage fo-stage--chat relative flex w-full min-w-0 flex-col">
      <div className="fo-chat-nav relative z-20 shrink-0">
        <SiteNav />
      </div>
      <div className="fo-chat-app relative z-10 flex min-w-0 flex-col overflow-x-clip">
        <Suspense
          fallback={
            <div
              className="flex flex-1 flex-col items-center justify-center gap-2 py-20"
              role="status"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--electric)]" aria-hidden />
              <p className="text-xs font-medium text-[var(--ink-faint)]">
                Connecting to Ava…
              </p>
            </div>
          }
        >
          <ChatConsole />
        </Suspense>
      </div>
    </main>
  );
}

