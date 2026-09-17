export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export const FAQS: FAQItem[] = [
  {
    id: 'pricing-model',
    question: "How Does FlightOne's Pricing Work?",
    answer: "Every trip is priced from live airfare and hotel rates on the day we build your quote, itemised line by line, and locked in once you approve it. There are no fixed packages and no hidden add-ons at any stage."
  },
  {
    id: 'free-itinerary',
    question: "Is Requesting An Itinerary Really Free?",
    answer: "Yes. There is no cost until you review and approve the final plan and price."
  },
  {
    id: 'destinations-covered',
    question: "Which Destinations Does FlightOne Cover?",
    answer: "Nine destinations: the Maldives, Turkey, Dubai, Thailand, Malaysia, Singapore, Sri Lanka, Morocco and Egypt, along with dedicated honeymoon, family and group trip planning across all of them."
  },
  {
    id: 'visa-guarantee',
    question: "Does FlightOne Guarantee Visa Approval?",
    answer: "No agency can guarantee a visa, since approval always rests with the relevant consulate or immigration authority. We prepare complete, compliant files and tell you honestly about any weak points before you spend money."
  },
  {
    id: 'payments-deposits',
    question: "How Do Payments And Deposits Work?",
    answer: "A deposit confirms your bookings once you approve the quote, and the balance follows a schedule stated directly on that same quote. There are no surprise charges once you've approved a trip."
  },
  {
    id: 'visa-refusal',
    question: "What Happens If My Visa Is Refused?",
    answer: "Booking components refund according to each individual supplier's written policy, shown to you before you pay. Government visa fees are non-refundable by any agency, anywhere."
  },
  {
    id: 'standalone-services',
    question: "Can I Book Only Hotels Or Only Visa Assistance?",
    answer: "Yes. Standalone bookings and independent visa assistance are both available without booking a complete trip through us."
  },
  {
    id: 'group-trips',
    question: "Does FlightOne Plan Group And Corporate Trips?",
    answer: "Yes, from 10 travellers upward, with negotiated group airfare, rooming lists and single-invoice billing. See our group tour packages."
  },
  {
    id: 'esim-usage',
    question: "How Do E-SIMs Work With My Trip?",
    answer: "Add one to any booking, or purchase a travel e-SIM as a standalone product. The QR code arrives by email before you fly, so you land already connected. See our travel e-SIMs."
  },
  {
    id: 'quote-turnaround',
    question: "How Quickly Will I Receive My Quote?",
    answer: "Within 24 hours of a complete request for most trips. Simple, single-destination itineraries are often faster, while complex multi-country routes can occasionally take a little longer, and we'll tell you upfront if that applies to your trip."
  }
];
