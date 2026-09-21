/**
 * FlightOne Travel — structured content seeded from https://www.flightone.co/
 * (live homepage inventory, Jul 2026). Used by the Earth Odyssey landing for
 * stakeholder demos. Prefer this module over hard-coded marketing strings.
 */

export type HotelTier = 3 | 4 | 5;

export type FlightOneDestination = {
  id: string;
  name: string;
  /** Approximate map pin for the globe / atlas */
  lat: number;
  lng: number;
  accent: string;
  fromPkr: number;
  visa: string;
  bestFor: string;
  blurb: string;
  hero?: boolean;
};

export type FlightOneTestimonial = {
  name: string;
  when: string;
  quote: string;
};

export const FLIGHTONE_BRAND = {
  name: "FlightOne Travel",
  shortName: "FlightOne",
  tagline: "Custom tour packages global, designed around you",
  promise: "Your itinerary in 24 hours. Free to request. No obligation to book.",
  metaDescription:
    "FlightOne designs custom tour packages globally for the Maldives, Turkey, Dubai and more. Get a full itinerary with honest pricing within 24 hours.",
  address: "71 C3, Facing Qarshi Park, Gulberg III, Lahore",
  phoneDisplay: "+92 327 777 0170",
  phoneE164: "+923277770170",
  whatsappUrl: "https://wa.me/923277770170",
  whatsappPrefill:
    "Hi FlightOne, I would like a custom tour package. Please share details about my trip.",
  email: "info@flightone.co",
  hours: "Mon – Sat: 10 am – 7 pm (PKT). Sunday closed.",
  instagram: "https://www.instagram.com/flightone",
  siteUrl: "https://www.flightone.co/",
  stats: [
    { value: "9", label: "Destinations" },
    { value: "24h", label: "Itinerary turnaround" },
    { value: "3", label: "Hotel comfort tiers" },
  ],
} as const;

// `message` is annotated `string` deliberately. Without it, TypeScript infers
// the parameter type from the default — and because FLIGHTONE_BRAND is `as
// const`, that default is a string *literal* type, so passing any other message
// fails to compile.
export function whatsappHref(message: string = FLIGHTONE_BRAND.whatsappPrefill): string {
  return `${FLIGHTONE_BRAND.whatsappUrl}?text=${encodeURIComponent(message)}`;
}

export function formatPkrFrom(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export const FLIGHTONE_DESTINATIONS: FlightOneDestination[] = [
  {
    id: "maldives",
    name: "Maldives",
    lat: 3.2028,
    lng: 73.2207,
    accent: "#00FF87",
    fromPkr: 385_000,
    visa: "Free visa on arrival",
    bestFor: "Honeymoons, beach rest",
    blurb: "Free visa on arrival and overwater villas — built around your dates.",
    hero: true,
  },
  {
    id: "sri-lanka",
    name: "Sri Lanka",
    lat: 7.8731,
    lng: 80.7718,
    accent: "#7DD3FC",
    fromPkr: 265_000,
    visa: "Free ETA (since May 2026)",
    bestFor: "Value, scenery, tea country",
    blurb: "Free entry visa for Pakistanis since May 2026 — scenery without the markup.",
    hero: true,
  },
  {
    id: "dubai",
    name: "Dubai",
    lat: 25.2048,
    lng: 55.2708,
    accent: "#FBBF24",
    fromPkr: 245_000,
    visa: "Pre-approved e-visa",
    bestFor: "First international trip",
    blurb: "Three-hour flight, built for first-time travellers.",
    hero: true,
  },
  {
    id: "malaysia",
    name: "Malaysia",
    lat: 3.139,
    lng: 101.6869,
    accent: "#34D399",
    fromPkr: 295_000,
    visa: "Online eVisa",
    bestFor: "Families, budget variety",
    blurb: "Family-friendly routes with clear eVisa coaching.",
  },
  {
    id: "thailand",
    name: "Thailand",
    lat: 13.7563,
    lng: 100.5018,
    accent: "#F472B6",
    fromPkr: 325_000,
    visa: "Mandatory e-Visa",
    bestFor: "Beaches plus city life",
    blurb: "Bangkok's energy plus Phuket's beaches — one continuous plan.",
    hero: true,
  },
  {
    id: "singapore",
    name: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    accent: "#A78BFA",
    fromPkr: 350_000,
    visa: "Authorised-agent visa",
    bestFor: "Families, city breaks",
    blurb: "City breaks with authorised-agent visa handling baked in.",
  },
  {
    id: "turkey",
    name: "Turkey",
    lat: 38.9637,
    lng: 35.2433,
    accent: "#FB7185",
    fromPkr: 450_000,
    visa: "e-Visa or sticker visa",
    bestFor: "Culture, honeymoons",
    blurb: "Istanbul, Cappadocia and Antalya in one trip — nothing templated.",
    hero: true,
  },
  {
    id: "morocco",
    name: "Morocco",
    lat: 31.7917,
    lng: -7.0926,
    accent: "#F59E0B",
    fromPkr: 385_000,
    visa: "Embassy sticker visa",
    bestFor: "Culture, desert experiences",
    blurb: "Desert and medina itineraries with embassy visa prep.",
  },
  {
    id: "egypt",
    name: "Egypt (Nile Cruise)",
    lat: 26.8206,
    lng: 30.8025,
    accent: "#38BDF8",
    fromPkr: 350_000,
    visa: "Embassy visa",
    bestFor: "History, Nile cruising",
    blurb: "Nile cruise history routes with full visa file support.",
  },
];

export const FLIGHTONE_STEPS = [
  {
    step: "01",
    title: "Tell us about your trip",
    body: "Send your destination, travel dates, number of travellers and preferred hotel tier through WhatsApp or our form. About two minutes.",
  },
  {
    step: "02",
    title: "We design your itinerary",
    body: "A dedicated designer builds flights, hotels, daily activities and transfers — transparent pricing within 24 hours.",
  },
  {
    step: "03",
    title: "You travel with everything handled",
    body: "Visa documentation, confirmed bookings, and one WhatsApp contact from first inquiry to your flight home.",
  },
] as const;

export const FLIGHTONE_STYLES = [
  {
    id: "honeymoon",
    tag: "Romantic",
    title: "Honeymoon packages",
    body: "Overwater villas in the Maldives, cave suites in Cappadocia, and private dinners arranged around your dates — not a group schedule.",
  },
  {
    id: "family",
    tag: "Family",
    title: "Family holidays",
    body: "Connecting rooms, kid-friendly resorts, and flight times that actually work for children.",
  },
  {
    id: "group",
    tag: "Groups",
    title: "Group and corporate trips",
    body: "Retreats, incentive travel, and friend-group getaways with group airfare and one consolidated invoice (10+ travellers).",
  },
  {
    id: "esim",
    tag: "Add-on",
    title: "e-SIM add-ons",
    body: "Land connected — ready-to-activate e-SIM by email before you fly, or buy standalone.",
  },
] as const;

export const FLIGHTONE_PILLARS = [
  {
    title: "Your itinerary in 24 hours",
    body: "A complete day-by-day plan with hotel names and final pricing within one day of your request.",
  },
  {
    title: "Transparent pricing, always in writing",
    body: "Every quote lists what is included and what is not. The number you approve is the number you pay.",
  },
  {
    title: "Three comfort tiers on every route",
    body: "Quote the same trip at 3-star, 4-star and 5-star so you can compare where the extra cost improves the trip.",
  },
  {
    title: "Visa support built in",
    body: "We prepare your complete visa file and tell you honestly if your profile has a weak point before you spend.",
  },
] as const;

export const FLIGHTONE_TESTIMONIALS: FlightOneTestimonial[] = [
  {
    name: "Ahmed Raza",
    when: "2 weeks ago",
    quote:
      "Planned our Turkey trip through FlightOne and honestly it was so easy. Sent them our dates on WhatsApp and had the full itinerary with hotel names and pricing the next day. The Cappadocia balloon ride was booked in advance so we didn't have to worry about it selling out.",
  },
  {
    name: "Sana Khalid",
    when: "1 month ago",
    quote:
      "We did our honeymoon in the Maldives with FlightOne, and it went beyond what we expected. They were very clear about pricing from the start, no hidden charges. Visa on arrival was smooth and our transfer was waiting when we landed.",
  },
  {
    name: "Bilal Ahmed",
    when: "3 weeks ago",
    quote:
      "Good experience overall for our Dubai family trip. Visa took a couple days longer than expected but they kept us updated the whole time. Kids loved the desert safari; hotel was exactly as described.",
  },
  {
    name: "Fatima Malik",
    when: "2 months ago",
    quote:
      "Booked a group trip to Thailand for 12 of us and FlightOne handled everything — flights, hotel, visas, even the island tour. One invoice for the whole group made splitting cost so much easier.",
  },
  {
    name: "Usman Tariq",
    when: "1 week ago",
    quote:
      "First time travelling abroad and I was nervous about the Malaysia visa. FlightOne explained everything clearly and handled the eVisa and arrival card. Trip went without a single issue.",
  },
];

export const FLIGHTONE_FAQS = [
  {
    q: "How does FlightOne's pricing work?",
    a: "Every trip is priced from live airfare and hotel rates on the day we build your quote, itemised line by line, and locked in once you approve it. No fixed packages, no hidden add-ons.",
  },
  {
    q: "Is requesting an itinerary really free?",
    a: "Yes. There is no cost until you review and approve the final plan and price.",
  },
  {
    q: "Which destinations does FlightOne cover?",
    a: "Nine destinations: Maldives, Turkey, Dubai, Thailand, Malaysia, Singapore, Sri Lanka, Morocco and Egypt — plus honeymoon, family and group planning across all of them.",
  },
  {
    q: "Does FlightOne guarantee visa approval?",
    a: "No agency can. Approval rests with the consulate or immigration authority. We prepare complete files and flag weak points before you spend money on bookings.",
  },
  {
    q: "How do payments and deposits work?",
    a: "A deposit confirms bookings once you approve the quote; the balance follows the schedule on that same quote. No surprise charges after approval.",
  },
  {
    q: "Can I book only hotels or only visa assistance?",
    a: "Yes. Standalone bookings and independent visa assistance are available without a full package.",
  },
  {
    q: "Does FlightOne plan group and corporate trips?",
    a: "Yes — from 10 travellers upward, with negotiated group airfare, rooming lists and single-invoice billing.",
  },
  {
    q: "How quickly will I receive my quote?",
    a: "Within 24 hours of a complete request for most trips. We'll tell you upfront if a complex multi-country route needs longer.",
  },
] as const;
