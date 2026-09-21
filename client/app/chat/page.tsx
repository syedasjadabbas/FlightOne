import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { Suspense } from "react";
import { SiteNav } from "@/components/SiteNav";

const ChatConsole = dynamic(
  () =>
    import("@/app/components/ChatConsole").then((m) => ({
      default: m.ChatConsole,
    })),
  { loading: () => <RouteChunkFallback label="Connecting to Ava…" /> },
);

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
          fallback={<RouteChunkFallback label="Connecting to Ava…" />}
        >
          <ChatConsole />
        </Suspense>
      </div>
    </main>
  );
}
