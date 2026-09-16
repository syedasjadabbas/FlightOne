"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useLogoutMutation } from "@/lib/api/auth.api";

type HubModule = {
  title: string;
  href: string;
  description: string;
  badge?: string;
  iconSvg: React.ReactNode;
};

type HubSection = {
  title: string;
  description: string;
  modules: HubModule[];
};

const SECTIONS: HubSection[] = [
  {
    title: "Core Travel & Accounts",
    description: "Your active journeys, documents, and personalized booking preferences.",
    modules: [
      {
        title: "Live Journeys",
        href: "/journey",
        description: "Live flight radar, gate assignments, delay alerts, and rebooking tools.",
        badge: "Live Radar",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        ),
      },
      {
        title: "Traveller Vault",
        href: "/vault",
        description: "Encrypted safe for passports, national IDs, visas, loyalty cards, and vouchers.",
        badge: "Encrypted",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        ),
      },
      {
        title: "Traveller Profile",
        href: "/profile",
        description: "Personal preferences, cabin class, seating, dietary choices, and saved companions.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        ),
      },
      {
        title: "Travel Consultant",
        href: "/chat",
        description: "Personalized flight search, multi-city itineraries, and instant trip comparisons.",
        badge: "Concierge",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        ),
      },
    ],
  },
  {
    title: "Travel Services & Protection",
    description: "Requirements advisory, refund claims, and frequent flyer rewards.",
    modules: [
      {
        title: "Visa Advisory & Entry Rules",
        href: "/visa",
        description: "Official destination visa rules, held visa validations, and transit requirements.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        ),
      },
      {
        title: "Refunds & Disruption Claims",
        href: "/refunds",
        description: "Submit cancellation requests, check disruption compensation, and track status.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        ),
      },
      {
        title: "Rewards & Multipliers",
        href: "/rewards",
        description: "View point balance, membership tier benefits, and point redemption catalogs.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        ),
      },
    ],
  },
  {
    title: "Specialized & Enterprise Travel",
    description: "Business travel policies, corporate invoicing, and group event coordination.",
    modules: [
      {
        title: "Corporate Program",
        href: "/corporate",
        description: "Company travel policy compliance, manager approvals, and consolidated invoicing.",
        badge: "Business",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        ),
      },
      {
        title: "Group Bookings (10+)",
        href: "/groups",
        description: "Coordinated itineraries, room blocks, split payments, and passenger rosters.",
        badge: "10+ Pax",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        ),
      },
      {
        title: "MICE & Events",
        href: "/mice",
        description: "Meetings, incentives, conferences, and exhibitions travel logistics.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        ),
      },
    ],
  },
  {
    title: "Operations & Platform Desks",
    description: "Human consultant escalation, agent workbench, and supplier health monitoring.",
    modules: [
      {
        title: "Consultant Dashboard",
        href: "/dashboard",
        description: "Live conversion metrics, search trends, quote performance, and supplier health.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        ),
      },
      {
        title: "Operations Desk",
        href: "/ops",
        description: "Live booking queue, GDS ticketing queues, and manual revalidation workbench.",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
        ),
      },
      {
        title: "Support & Escalations",
        href: "/escalations",
        description: "Connect with human travel consultants, view ticket status, and request urgent aid.",
        badge: "24/7 Human",
        iconSvg: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
          />
        ),
      },
    ],
  },
];

export function MorePageClient() {
  const authUser = useAuthStore((s) => s.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  return (
    <div className="w-full space-y-12">
      {/* Hero Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-700">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
            FlightOne Platform Directory
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            Account & Platform Hub
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
            Explore all services, booking desks, policy tools, and account capabilities available on FlightOne.
          </p>
        </div>

        {authUser && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white font-bold text-sm">
              {(authUser.name || authUser.email)[0].toUpperCase()}
            </div>
            <div className="text-xs">
              <div className="font-semibold text-slate-900 truncate max-w-[160px]">
                {authUser.name || "Traveller"}
              </div>
              <div className="text-slate-500 truncate max-w-[160px]">{authUser.email}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoggingOut}
              onClick={() => void logout()}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              {isLoggingOut ? "…" : "Log out"}
            </Button>
          </div>
        )}
      </div>

      {/* Sections & Cards */}
      <div className="space-y-10">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                {sec.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">{sec.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sec.modules.map((mod) => (
                <Link
                  key={mod.title}
                  href={mod.href}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-cyan-300 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-700 transition-colors">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {mod.iconSvg}
                        </svg>
                      </div>
                      {mod.badge && (
                        <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-800">
                          {mod.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-bold text-slate-900 tracking-tight group-hover:text-cyan-800 transition-colors font-[var(--font-sora)]">
                      {mod.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-cyan-700 group-hover:translate-x-0.5 transition-transform">
                    <span>Open Service</span>
                    <span>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
