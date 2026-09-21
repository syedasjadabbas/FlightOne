import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Clock3,
  Gift,
  Headphones,
  Lock,
  MessageCircle,
  Navigation,
  Settings2,
  Stamp,
  Undo2,
  UserRound,
  Users,
} from "lucide-react";

export type MoreModule = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export type MoreSection = {
  title: string;
  description: string;
  modules: MoreModule[];
};

export const MORE_SECTIONS: MoreSection[] = [
  {
    title: "Travel & account",
    description: "Journeys, documents, preferences, and booking help.",
    modules: [
      {
        title: "Live journeys",
        href: "/journey",
        description: "Flight status, gates, delays, and rebooking.",
        icon: Navigation,
      },
      {
        title: "Traveller vault",
        href: "/vault",
        description: "Passports, visas, loyalty cards, and vouchers.",
        icon: Lock,
      },
      {
        title: "Traveller profile",
        href: "/profile",
        description: "Cabin, seating, dietary needs, and companions.",
        icon: UserRound,
      },
      {
        title: "Travel consultant",
        href: "/chat",
        description: "Search flights, build itineraries, compare options.",
        icon: MessageCircle,
      },
      {
        title: "Autonomous concierge",
        href: "/concierge",
        description: "Delay rules you pre-authorise; payment still gates bookings.",
        icon: Clock3,
      },
    ],
  },
  {
    title: "Services & protection",
    description: "Entry rules, claims, and rewards.",
    modules: [
      {
        title: "Visa & entry rules",
        href: "/visa",
        description: "Destination requirements and transit checks.",
        icon: Stamp,
      },
      {
        title: "Refunds & claims",
        href: "/refunds",
        description: "Cancellations, disruption claims, and status.",
        icon: Undo2,
      },
      {
        title: "Rewards",
        href: "/rewards",
        description: "Points balance, tier benefits, and redemption.",
        icon: Gift,
      },
    ],
  },
  {
    title: "Enterprise & groups",
    description: "Company policy, group travel, and events.",
    modules: [
      {
        title: "Corporate program",
        href: "/corporate",
        description: "Policy, approvals, and consolidated invoicing.",
        icon: Building2,
      },
      {
        title: "Group bookings",
        href: "/groups",
        description: "Shared itineraries, rosters, and split payments.",
        icon: Users,
      },
      {
        title: "MICE & events",
        href: "/mice",
        description: "Meetings, incentives, conferences, exhibitions.",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Operations desks",
    description: "Consultant tools, ops workbench, and support.",
    modules: [
      {
        title: "Consultant dashboard",
        href: "/dashboard",
        description: "Conversion, quotes, and supplier health.",
        icon: BarChart3,
      },
      {
        title: "Operations desk",
        href: "/ops",
        description: "Booking queue, ticketing, and revalidation.",
        icon: Settings2,
      },
      {
        title: "Support & escalations",
        href: "/escalations",
        description: "Human consultants and urgent case status.",
        icon: Headphones,
      },
    ],
  },
];
