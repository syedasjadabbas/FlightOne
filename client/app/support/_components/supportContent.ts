import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Briefcase,
  CreditCard,
  Headphones,
  Map,
  MessageCircle,
  Plane,
  Stamp,
  Undo2,
} from "lucide-react";

export type SupportFaq = { q: string; a: string };

export type SupportTopic = {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  faqs: SupportFaq[];
};

export type SupportPath = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type SupportRelated = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
};

/** Primary ways into help — answers, chat, human case. */
export const SUPPORT_PATHS: SupportPath[] = [
  {
    href: "#topics",
    title: "Browse answers",
    description: "Bookings, payments, refunds, visas, and special services.",
    icon: Headphones,
  },
  {
    href: "/chat",
    title: "Chat with Ava",
    description: "Live trip questions without opening a case.",
    icon: MessageCircle,
  },
  {
    href: "/escalations",
    title: "Open a case",
    description: "Human consultant when you need a review or status.",
    icon: Plane,
  },
];

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "booking",
    icon: Plane,
    title: "Bookings & itineraries",
    desc: "Changes, seats, names, schedule updates, baggage",
    faqs: [
      {
        q: "How do I correct passenger details?",
        a: "Names on confirmed tickets must match the passport. Minor spelling fixes (up to 3 characters) can be handled by support. Full passenger replacements depend on the airline’s policy.",
      },
      {
        q: "What if my flight is delayed or rescheduled?",
        a: "When a change exceeds 60 minutes or breaks a connection, Ava and ops will surface rebooking options or an involuntary refund path — without inventing fees.",
      },
      {
        q: "Where do I track active flights?",
        a: "Open My Journey for gates, terminals, delays, and baggage carousels.",
      },
    ],
  },
  {
    id: "payment",
    icon: CreditCard,
    title: "Payments & invoicing",
    desc: "Cards, JazzCash/Easypaisa, 1Link IBFT, receipts",
    faqs: [
      {
        q: "Which payment methods are supported?",
        a: "Visa, Mastercard, UnionPay, JazzCash, Easypaisa, and 1Link IBFT. Corporate accounts may pay against an approved credit limit.",
      },
      {
        q: "How do I get a tax / GST invoice?",
        a: "Completed bookings include a digital invoice in Profile and Vault. Corporate members can export monthly statements from the Corporate desk.",
      },
    ],
  },
  {
    id: "refunds",
    icon: Undo2,
    title: "Cancellations & refunds",
    desc: "Eligibility, exchanges, travel credits",
    faqs: [
      {
        q: "How are refund amounts calculated?",
        a: "From stored fare rules and supplier penalties only. Check Refunds for a breakdown before filing a claim.",
      },
      {
        q: "How long do refunds take?",
        a: "After carrier approval: card and wallet refunds typically 5–10 business days; IBFT within about 3 business days.",
      },
    ],
  },
  {
    id: "visa",
    icon: Stamp,
    title: "Visas & documents",
    desc: "Entry rules, passport validity, embassy appointments",
    faqs: [
      {
        q: "How much passport validity do I need?",
        a: "Most destinations require at least 6 months from your return date. Use Visa Advisory for your passport and route.",
      },
      {
        q: "Can FlightOne help with embassy biometrics?",
        a: "Yes — document checks, application checklists, and appointment tracking for tourist and business travel.",
      },
    ],
  },
  {
    id: "corporate",
    icon: Briefcase,
    title: "Corporate & groups",
    desc: "Policy, approvals, book-on-behalf, 10+ pax",
    faqs: [
      {
        q: "How do corporate approvals work?",
        a: "Bookings over policy thresholds route to designated approvers in the Corporate desk for one-click decision.",
      },
      {
        q: "How do I book for 10 or more travellers?",
        a: "Submit routes, seat blocks, and date flexibility on Group Bookings.",
      },
    ],
  },
  {
    id: "special",
    icon: Accessibility,
    title: "Special services & medical",
    desc: "Wheelchair, UMNR, meals, fit-to-fly",
    faqs: [
      {
        q: "How do I request wheelchair assistance or special meals?",
        a: "Add SSR during selection or open a support case at least 24 hours before departure.",
      },
    ],
  },
];

export const SUPPORT_RELATED: SupportRelated[] = [
  {
    href: "/journey",
    label: "My Journey",
    hint: "Gates, delays, boarding",
    icon: Map,
  },
  {
    href: "/refunds",
    label: "Refunds",
    hint: "Claims and eligibility",
    icon: Undo2,
  },
  {
    href: "/visa",
    label: "Visa advisory",
    hint: "Entry rules and documents",
    icon: Stamp,
  },
  {
    href: "/escalations",
    label: "My cases",
    hint: "Track consultant reviews",
    icon: Headphones,
  },
];
