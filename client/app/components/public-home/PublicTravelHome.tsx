"use client";

import { useState, useId, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";

type TabType = "flights" | "stays" | "cars";
type TripType = "roundtrip" | "oneway";
type CabinClass = "economy" | "premium_economy" | "business" | "first";

type AirportOption = {
  city: string;
  code: string;
  country: string;
  airport: string;
};

const POPULAR_AIRPORTS: AirportOption[] = [
  { city: "Lahore", code: "LHE", country: "Pakistan", airport: "Allama Iqbal Intl" },
  { city: "Dubai", code: "DXB", country: "United Arab Emirates", airport: "Dubai Intl" },
  { city: "Karachi", code: "KHI", country: "Pakistan", airport: "Jinnah Intl" },
  { city: "Islamabad", code: "ISB", country: "Pakistan", airport: "Islamabad Intl" },
  { city: "London", code: "LHR", country: "United Kingdom", airport: "Heathrow" },
  { city: "Istanbul", code: "IST", country: "Turkey", airport: "Istanbul Airport" },
  { city: "Bangkok", code: "BKK", country: "Thailand", airport: "Suvarnabhumi" },
  { city: "Jeddah", code: "JED", country: "Saudi Arabia", airport: "King Abdulaziz Intl" },
  { city: "New York", code: "JFK", country: "United States", airport: "John F. Kennedy" },
  { city: "Tokyo", code: "HND", country: "Japan", airport: "Haneda Airport" },
  { city: "Doha", code: "DOH", country: "Qatar", airport: "Hamad Intl" },
  { city: "San Francisco", code: "SFO", country: "United States", airport: "San Francisco Intl" },
];

const POPULAR_DESTINATIONS = [
  {
    city: "Dubai",
    country: "United Arab Emirates",
    code: "DXB",
    pricePkr: "PKR 88,500",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
    query: "Flights from Lahore to Dubai next week nonstop",
  },
  {
    city: "Istanbul",
    country: "Turkey",
    code: "IST",
    pricePkr: "PKR 142,000",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=800&q=80",
    query: "Flights to Istanbul Turkey next month best fare",
  },
  {
    city: "London",
    country: "United Kingdom",
    code: "LHR",
    pricePkr: "PKR 195,000",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    query: "Roundtrip flights to London Heathrow for 1 adult in economy",
  },
  {
    city: "Bangkok",
    country: "Thailand",
    code: "BKK",
    pricePkr: "PKR 118,000",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80",
    query: "Cheapest flights to Bangkok Thailand next month",
  },
  {
    city: "Jeddah",
    country: "Saudi Arabia",
    code: "JED",
    pricePkr: "PKR 92,000",
    image: "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?auto=format&fit=crop&w=800&q=80",
    query: "Direct flights to Jeddah Saudi Arabia",
  },
];

const FEATURED_STAYS = [
  {
    name: "Atlantis The Royal",
    location: "Dubai, UAE",
    rating: "4.9",
    reviews: "1,140",
    priceNight: "PKR 185,000",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80",
    query: "Hotels in Dubai Palm Jumeirah luxury resort with breakfast",
  },
  {
    name: "Ritz-Carlton",
    location: "Istanbul, Turkey",
    rating: "4.8",
    reviews: "980",
    priceNight: "PKR 85,000",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    query: "5-star hotels in Istanbul near Bosphorus with sea view",
  },
  {
    name: "The Langham",
    location: "London, UK",
    rating: "4.9",
    reviews: "2,150",
    priceNight: "PKR 185,000",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80",
    query: "Luxury hotels in London central near Regent Street",
  },
  {
    name: "Banyan Tree",
    location: "Bangkok, Thailand",
    rating: "4.8",
    reviews: "1,020",
    priceNight: "PKR 48,000",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80",
    query: "Hotels in Bangkok with rooftop pool and breakfast",
  },
];

const POPULAR_CHIPS = [
  { label: "Lahore → Dubai", fromCode: "LHE", fromName: "Lahore (LHE)", toCode: "DXB", toName: "Dubai (DXB)" },
  { label: "Lahore → Istanbul", fromCode: "LHE", fromName: "Lahore (LHE)", toCode: "IST", toName: "Istanbul (IST)" },
  { label: "Karachi → London", fromCode: "KHI", fromName: "Karachi (KHI)", toCode: "LHR", toName: "London (LHR)" },
  { label: "Islamabad → Jeddah", fromCode: "ISB", fromName: "Islamabad (ISB)", toCode: "JED", toName: "Jeddah (JED)" },
  { label: "Lahore → Bangkok", fromCode: "LHE", fromName: "Lahore (LHE)", toCode: "BKK", toName: "Bangkok (BKK)" },
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

export function PublicTravelHome() {
  const router = useRouter();

  // Search state
  const [tab, setTab] = useState<TabType>("flights");
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);

  // Dropdown states
  const [passengerDropdownOpen, setPassengerDropdownOpen] = useState(false);
  const [tripTypeDropdownOpen, setTripTypeDropdownOpen] = useState(false);
  const [cabinDropdownOpen, setCabinDropdownOpen] = useState(false);

  // Flight locations
  const [origin, setOrigin] = useState("LHE");
  const [originText, setOriginText] = useState("Lahore (LHE)");
  const [originOpen, setOriginOpen] = useState(false);

  const [destination, setDestination] = useState("DXB");
  const [destinationText, setDestinationText] = useState("Dubai (DXB)");
  const [destinationOpen, setDestinationOpen] = useState(false);

  // Stays & Cars state
  const [stayCity, setStayCity] = useState("Dubai, UAE");
  const [carCity, setCarCity] = useState("Dubai Intl Airport (DXB)");

  // Dates: departure = +7 days, return = +18 days (matching Mon, 29 Sep / Fri, 10 Oct style)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 18);
    return d.toISOString().slice(0, 10);
  });

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const passengerRef = useRef<HTMLDivElement>(null);
  const tripTypeRef = useRef<HTMLDivElement>(null);
  const cabinRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (passengerRef.current && !passengerRef.current.contains(e.target as Node)) {
        setPassengerDropdownOpen(false);
      }
      if (tripTypeRef.current && !tripTypeRef.current.contains(e.target as Node)) {
        setTripTypeDropdownOpen(false);
      }
      if (cabinRef.current && !cabinRef.current.contains(e.target as Node)) {
        setCabinDropdownOpen(false);
      }
      if (originRef.current && !originRef.current.contains(e.target as Node)) {
        setOriginOpen(false);
      }
      if (destinationRef.current && !destinationRef.current.contains(e.target as Node)) {
        setDestinationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Swap origin and destination
  const handleSwap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tempCode = origin;
    const tempText = originText;
    setOrigin(destination);
    setOriginText(destinationText);
    setDestination(tempCode);
    setDestinationText(tempText);
  };

  // Submit search
  const handleFlightSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const passengersCount = adults + children;
    const cabinLabel =
      cabinClass === "business"
        ? "business class"
        : cabinClass === "first"
        ? "first class"
        : cabinClass === "premium_economy"
        ? "premium economy"
        : "economy";

    let query = "";
    if (tripType === "roundtrip" && returnDate) {
      query = `Roundtrip flights from ${origin} to ${destination} departing ${departureDate} returning ${returnDate} for ${passengersCount} passenger in ${cabinLabel}`;
    } else {
      query = `One-way flight from ${origin} to ${destination} departing ${departureDate} for ${passengersCount} passenger in ${cabinLabel}`;
    }

    router.push(`/chat?q=${encodeURIComponent(query)}`);
  };

  const handleStaySearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const guests = adults + children;
    const query = `Hotels in ${stayCity} checking in ${departureDate} checking out ${returnDate} for ${guests} guests`;
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  };

  const handleCarSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = `Rental cars in ${carCity} from ${departureDate} to ${returnDate}`;
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  };

  const handlePromptClick = (promptText: string) => {
    router.push(`/chat?q=${encodeURIComponent(promptText)}`);
  };

  const handleChipClick = (chip: (typeof POPULAR_CHIPS)[0]) => {
    setOrigin(chip.fromCode);
    setOriginText(chip.fromName);
    setDestination(chip.toCode);
    setDestinationText(chip.toName);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setNewsletterSubscribed(true);
    }
  };

  const passengersTotal = adults + children;
  const cabinDisplayName =
    cabinClass === "economy"
      ? "Economy"
      : cabinClass === "premium_economy"
      ? "Premium Economy"
      : cabinClass === "business"
      ? "Business"
      : "First";

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] text-slate-900 font-sans antialiased selection:bg-[#0264d6]/15 selection:text-[#0264d6]">
      {/* ── Header ── */}
      <SiteNav variant="marketplace" />

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-[#faf9f5]">
        {/* Airplane wing background photography */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2200&q=85"
            alt="Scenic flight over mountain landscape"
            className="w-full h-full object-cover object-[78%_center] lg:object-right"
          />
          {/* Subtle warm light gradient over the left side to keep editorial copy readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#faf9f5] via-[#faf9f5]/85 md:via-[#faf9f5]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/5" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-20 sm:pb-32 lg:pt-24 lg:pb-36">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Left Headline & Copy */}
            <div className="max-w-xl">
              <span className="inline-block text-[11px] sm:text-xs font-semibold tracking-[0.2em] text-slate-600 uppercase mb-3 sm:mb-4">
                Travel Further
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.75rem] font-normal tracking-tight text-slate-950 leading-[1.08]">
                Discover a<br />
                More Open World
              </h1>
              <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-700 max-w-md leading-relaxed">
                Flights, stays and seamless travel experiences — all in one place.
              </p>
            </div>

            {/* Right Subtle Editorial Note over the wing */}
            <div className="hidden md:block lg:text-right pr-6 lg:pr-12">
              <p className="font-serif italic text-xs text-slate-700/85 tracking-wide leading-snug">
                A<br />
                Smoother<br />
                Way to Travel
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search Panel Container (Elevated Floating Card overlapping Hero) ── */}
      <section id="search-panel" className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-16 lg:-mt-20">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/6 border border-slate-200/90 p-5 sm:p-7">
          {/* Top Bar: Tabs (Left) & Controls (Right) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("flights")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  tab === "flights"
                    ? "bg-sky-50 text-[#0264d6]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Flights
              </button>

              <button
                type="button"
                onClick={() => setTab("stays")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  tab === "stays"
                    ? "bg-sky-50 text-[#0264d6]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Stays
              </button>

              <button
                type="button"
                onClick={() => setTab("cars")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  tab === "cars"
                    ? "bg-sky-50 text-[#0264d6]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8m-8 4h8m-6 4h4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Cars
              </button>
            </div>

            {/* Flight Controls (Trip Type, Passengers, Cabin) */}
            {tab === "flights" && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Trip Type Selector */}
                <div className="relative" ref={tripTypeRef}>
                  <button
                    type="button"
                    onClick={() => setTripTypeDropdownOpen(!tripTypeDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 hover:text-slate-950 font-medium hover:bg-slate-50 transition-colors"
                  >
                    <span>{tripType === "roundtrip" ? "Round trip" : "One-way"}</span>
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {tripTypeDropdownOpen && (
                    <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setTripType("roundtrip");
                          setTripTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${tripType === "roundtrip" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        Round trip
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTripType("oneway");
                          setTripTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${tripType === "oneway" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        One-way
                      </button>
                    </div>
                  )}
                </div>

                {/* Passengers Popover */}
                <div className="relative" ref={passengerRef}>
                  <button
                    type="button"
                    onClick={() => setPassengerDropdownOpen(!passengerDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 hover:text-slate-950 font-medium hover:bg-slate-50 transition-colors"
                  >
                    <span>{passengersTotal} passenger{passengersTotal > 1 ? "s" : ""}</span>
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {passengerDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 p-4 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 text-xs text-slate-800 animate-in fade-in zoom-in-95">
                      <div className="space-y-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Adults</p>
                            <p className="text-[11px] text-slate-500">Age 12+</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={adults <= 1}
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="w-4 text-center font-bold text-slate-900">{adults}</span>
                            <button
                              type="button"
                              disabled={adults >= 9}
                              onClick={() => setAdults(adults + 1)}
                              className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Children</p>
                            <p className="text-[11px] text-slate-500">Age 2–11</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={children <= 0}
                              onClick={() => setChildren(Math.max(0, children - 1))}
                              className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="w-4 text-center font-bold text-slate-900">{children}</span>
                            <button
                              type="button"
                              disabled={children >= 8}
                              onClick={() => setChildren(children + 1)}
                              className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 text-right">
                        <button
                          type="button"
                          onClick={() => setPassengerDropdownOpen(false)}
                          className="text-xs font-semibold text-[#0264d6] hover:underline"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cabin Class Selector */}
                <div className="relative" ref={cabinRef}>
                  <button
                    type="button"
                    onClick={() => setCabinDropdownOpen(!cabinDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 hover:text-slate-950 font-medium hover:bg-slate-50 transition-colors"
                  >
                    <span>{cabinDisplayName}</span>
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {cabinDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setCabinClass("economy");
                          setCabinDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${cabinClass === "economy" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        Economy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCabinClass("premium_economy");
                          setCabinDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${cabinClass === "premium_economy" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        Premium Economy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCabinClass("business");
                          setCabinDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${cabinClass === "business" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        Business
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCabinClass("first");
                          setCabinDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${cabinClass === "first" ? "font-bold text-[#0264d6]" : "text-slate-700"}`}
                      >
                        First Class
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>

          {/* ── Main Form (Flights) ── */}
          {tab === "flights" && (
            <form onSubmit={handleFlightSearch} className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch rounded-2xl border border-slate-200/90 bg-slate-50/70 p-1.5 gap-1.5 lg:gap-0 lg:divide-x divide-slate-200/80">
                {/* From Field */}
                <div className="lg:col-span-3 relative" ref={originRef}>
                  <div
                    onClick={() => setOriginOpen(!originOpen)}
                    className="h-full flex items-center gap-3 p-2.5 sm:p-3 hover:bg-slate-100/70 rounded-xl cursor-pointer transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                        From
                      </span>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {originText}
                      </p>
                    </div>
                  </div>

                  {/* Origin Dropdown Popover */}
                  {originOpen && (
                    <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-40 max-h-64 overflow-y-auto">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2.5 py-1.5">
                        Departure City / Airport
                      </p>
                      {POPULAR_AIRPORTS.map((air) => (
                        <div
                          key={`from-${air.code}`}
                          onClick={() => {
                            setOrigin(air.code);
                            setOriginText(`${air.city} (${air.code})`);
                            setOriginOpen(false);
                          }}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{air.city}, {air.country}</p>
                            <p className="text-[10px] text-slate-600">{air.airport}</p>
                          </div>
                          <span className="text-xs font-bold text-[#0264d6]">{air.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap Button (between From and To) */}
                <div className="flex justify-center items-center py-1 lg:py-0 lg:px-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleSwap}
                    aria-label="Swap departure and destination"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-950 shadow-xs transition-all active:scale-95"
                  >
                    ⇄
                  </button>
                </div>

                {/* To Field */}
                <div className="lg:col-span-3 relative" ref={destinationRef}>
                  <div
                    onClick={() => setDestinationOpen(!destinationOpen)}
                    className="h-full flex items-center gap-3 p-2.5 sm:p-3 hover:bg-slate-100/70 rounded-xl cursor-pointer transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                        To
                      </span>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {destinationText}
                      </p>
                    </div>
                  </div>

                  {/* Destination Dropdown Popover */}
                  {destinationOpen && (
                    <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-40 max-h-64 overflow-y-auto">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2.5 py-1.5">
                        Destination City / Airport
                      </p>
                      {POPULAR_AIRPORTS.filter((a) => a.code !== origin).map((air) => (
                        <div
                          key={`to-${air.code}`}
                          onClick={() => {
                            setDestination(air.code);
                            setDestinationText(`${air.city} (${air.code})`);
                            setDestinationOpen(false);
                          }}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{air.city}, {air.country}</p>
                            <p className="text-[10px] text-slate-600">{air.airport}</p>
                          </div>
                          <span className="text-xs font-bold text-[#0264d6]">{air.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Fields (Depart & Return) */}
                <div className="lg:col-span-3 grid grid-cols-2 divide-x divide-slate-200/80">
                  {/* Depart Date */}
                  <div className="relative h-full p-2.5 sm:p-3 hover:bg-slate-100/70 rounded-l-xl cursor-pointer transition-colors flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-slate-500 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                        Depart
                      </span>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {formatDateDisplay(departureDate)}
                      </p>
                    </div>
                    <input
                      type="date"
                      min={todayStr}
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>

                  {/* Return Date */}
                  <div className={`relative h-full p-2.5 sm:p-3 hover:bg-slate-100/70 rounded-r-xl transition-colors flex items-center gap-2.5 ${tripType === "oneway" ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                        Return
                      </span>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {tripType === "roundtrip" ? formatDateDisplay(returnDate) : "—"}
                      </p>
                    </div>
                    {tripType === "roundtrip" && (
                      <input
                        type="date"
                        min={departureDate || todayStr}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    )}
                  </div>
                </div>

                {/* Submit Search Button */}
                <div className="lg:col-span-2 p-1">
                  <button
                    type="submit"
                    className="w-full h-full py-3.5 px-6 rounded-xl bg-[#0264d6] hover:bg-[#0052b3] text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span>Search</span>
                  </button>
                </div>
              </div>

              {/* Popular Route Chips Row */}
              <div className="mt-4 pt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-600 font-medium mr-1">Popular:</span>
                {POPULAR_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 font-medium transition-colors border border-slate-200/60"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </form>
          )}

          {/* ── Form (Stays) ── */}
          {tab === "stays" && (
            <form onSubmit={handleStaySearch} className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                <div className="lg:col-span-5 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
                  <label className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-0.5">
                    Destination or Property
                  </label>
                  <input
                    type="text"
                    value={stayCity}
                    onChange={(e) => setStayCity(e.target.value)}
                    placeholder="e.g. Dubai, Istanbul, London, Bangkok"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                  <div className="relative p-3 bg-slate-50 border border-slate-200/90 rounded-2xl cursor-pointer">
                    <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      Check-in
                    </span>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {formatDateDisplay(departureDate)}
                    </p>
                    <input
                      type="date"
                      min={todayStr}
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>

                  <div className="relative p-3 bg-slate-50 border border-slate-200/90 rounded-2xl cursor-pointer">
                    <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      Check-out
                    </span>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {formatDateDisplay(returnDate)}
                    </p>
                    <input
                      type="date"
                      min={departureDate || todayStr}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#0264d6] hover:bg-[#0052b3] text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span>Search Stays</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── Form (Cars) ── */}
          {tab === "cars" && (
            <form onSubmit={handleCarSearch} className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                <div className="lg:col-span-5 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
                  <label className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-0.5">
                    Pick-up Location
                  </label>
                  <input
                    type="text"
                    value={carCity}
                    onChange={(e) => setCarCity(e.target.value)}
                    placeholder="Airport or city address"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                  <div className="relative p-3 bg-slate-50 border border-slate-200/90 rounded-2xl cursor-pointer">
                    <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      Pick-up Date
                    </span>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {formatDateDisplay(departureDate)}
                    </p>
                    <input
                      type="date"
                      min={todayStr}
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>

                  <div className="relative p-3 bg-slate-50 border border-slate-200/90 rounded-2xl cursor-pointer">
                    <span className="block text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      Drop-off Date
                    </span>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {formatDateDisplay(returnDate)}
                    </p>
                    <input
                      type="date"
                      min={departureDate || todayStr}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#0264d6] hover:bg-[#0052b3] text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span>Search Cars</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── Popular Destinations ("Where to next?") ── */}
      <section id="destinations" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase mb-1.5">
              Popular Destinations
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-slate-950 font-normal tracking-tight">
              Where to next?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
              Handpicked destinations, great fares, and unforgettable experiences.
            </p>
          </div>
          <Link
            href="/chat?q=Explore%20top%20global%20destinations"
            className="text-xs sm:text-sm font-semibold text-[#0264d6] hover:text-[#0052b3] transition-colors inline-flex items-center gap-1 group"
          >
            Explore all destinations <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* 5 Tall Portrait Destination Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {POPULAR_DESTINATIONS.map((dest) => (
            <div
              key={dest.code}
              onClick={() => handlePromptClick(dest.query)}
              className="group relative h-72 sm:h-80 lg:h-84 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-slate-900"
            >
              <img
                src={dest.image}
                alt={dest.city}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              {/* Overlaid Title & Fare */}
              <div className="absolute bottom-0 inset-x-0 p-4 text-white">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
                  {dest.city}
                </h3>
                <p className="text-xs text-white/90 font-medium mt-0.5 flex items-center gap-1">
                  <span>From</span>
                  <span className="font-semibold">{dest.pricePkr}</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Stays ("Extraordinary stays for every journey.") ── */}
      <section id="stays" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase mb-1.5">
              Featured Stays
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-slate-950 font-normal tracking-tight">
              Extraordinary stays for every journey.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
              From luxury escapes to business stays, find spaces that feel like home.
            </p>
          </div>
          <Link
            href="/chat?q=Explore%20luxury%20hotels%20and%20curated%20stays"
            className="text-xs sm:text-sm font-semibold text-[#0264d6] hover:text-[#0052b3] transition-colors inline-flex items-center gap-1 group"
          >
            Explore all stays <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* 4 Hotel Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURED_STAYS.map((stay) => (
            <div
              key={stay.name}
              onClick={() => handlePromptClick(stay.query)}
              className="group bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col"
            >
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src={stay.image}
                  alt={stay.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 group-hover:text-[#0264d6] transition-colors truncate">
                    {stay.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                    {stay.location}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-amber-500">★</span>
                    <span className="font-bold text-slate-900">{stay.rating}</span>
                    <span className="text-slate-600">({stay.reviews})</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">{stay.priceNight}</span>
                    <span className="text-slate-600 text-[11px]"> / night</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust / Value Section (4 Columns) ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {/* Col 1 */}
          <div className="flex flex-col items-center">
            <div className="text-slate-800 mb-3 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-950 text-sm sm:text-base">
              Global Inventory
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs">
              Access hundreds of airlines and hotel partners worldwide.
            </p>
          </div>

          {/* Col 2 */}
          <div className="flex flex-col items-center">
            <div className="text-slate-800 mb-3 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-950 text-sm sm:text-base">
              Transparent Pricing
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs">
              No hidden fees. What you see is what you pay.
            </p>
          </div>

          {/* Col 3 */}
          <div className="flex flex-col items-center">
            <div className="text-slate-800 mb-3 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-950 text-sm sm:text-base">
              24/7 Support
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs">
              Real people, whenever you need us.
            </p>
          </div>

          {/* Col 4 */}
          <div className="flex flex-col items-center">
            <div className="text-slate-800 mb-3 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-950 text-sm sm:text-base">
              Corporate Travel
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs">
              Simplify business travel for your team.
            </p>
          </div>
        </div>
      </section>

      {/* ── Editorial Promo Section ("Travel, better together.") ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column */}
          <div className="lg:col-span-6">
            <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase mb-2 sm:mb-3">
              More Than A Trip
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-slate-950 leading-tight">
              Travel, better together.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-4 max-w-lg">
              Whether it&apos;s a weekend getaway, an important business trip, or a once-in-a-lifetime destination — FlightOne helps you plan, book and manage it all with ease.
            </p>

            <div className="mt-6">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Start exploring</span>
                <span>→</span>
              </Link>
            </div>

            {/* Statistics Row */}
            <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-3 gap-4">
              <div>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-slate-950">500+</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Airlines & Hotels</p>
              </div>
              <div>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-slate-950">190+</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Countries</p>
              </div>
              <div>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-slate-950">1M+</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Happy Travelers</p>
              </div>
            </div>
          </div>

          {/* Right Column: Panoramic Lake Photograph with Quote */}
          <div className="lg:col-span-6">
            <div className="relative h-72 sm:h-96 rounded-3xl overflow-hidden shadow-lg bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=85"
                alt="Serene alpine lake vista with village and church reflection"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

              {/* Editorial Quote */}
              <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 max-w-xs text-white">
                <blockquote className="font-serif text-xl sm:text-2xl font-normal leading-snug">
                  “A simpler,<br />
                  smarter way<br />
                  to see the world.”
                </blockquote>
                <div className="w-8 h-0.5 bg-white/70 mt-3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Newsletter / Stay in the loop ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14 border-t border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase mb-1">
              Stay in the loop
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-slate-950 font-normal">
              Get travel inspiration, deals and updates.
            </h2>
          </div>

          <form onSubmit={handleNewsletterSubmit} className="flex items-center gap-2 max-w-md w-full sm:w-auto">
            {newsletterSubscribed ? (
              <span className="text-xs font-semibold text-emerald-600 px-4 py-2 bg-emerald-50 rounded-xl">
                ✓ Thank you for subscribing!
              </span>
            ) : (
              <>
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 sm:w-72 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs shrink-0"
                >
                  Subscribe
                </button>
              </>
            )}
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-[#fafaf9] border-t border-slate-200/80 pt-16 pb-12 text-slate-600 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-12">
            {/* Col 1: Brand & Tagline */}
            <div className="md:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2">
                <span className="text-[#0264d6] flex items-center">
                  <svg width="24" height="16" viewBox="0 0 44 32" fill="none" aria-hidden>
                    <path
                      d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="text-base font-bold tracking-tight text-slate-950">
                  Flight<span className="text-[#0264d6]">One</span>
                </span>
              </Link>
              <p className="mt-2 text-slate-600 text-[11px] leading-relaxed">
                Travel further. Together.
              </p>
            </div>

            {/* Col 2: Company */}
            <div>
              <p className="font-bold text-slate-950 uppercase tracking-wider text-[11px] mb-3">
                Company
              </p>
              <ul className="space-y-2">
                <li><Link href="/journey" className="hover:text-slate-950 transition-colors">About</Link></li>
                <li><Link href="/more" className="hover:text-slate-950 transition-colors">Careers</Link></li>
                <li><Link href="/more" className="hover:text-slate-950 transition-colors">Press</Link></li>
                <li><Link href="/escalations" className="hover:text-slate-950 transition-colors">Contact</Link></li>
              </ul>
            </div>

            {/* Col 3: Support */}
            <div>
              <p className="font-bold text-slate-950 uppercase tracking-wider text-[11px] mb-3">
                Support
              </p>
              <ul className="space-y-2">
                <li><Link href="/escalations" className="hover:text-slate-950 transition-colors">Help Center</Link></li>
                <li><Link href="/escalations" className="hover:text-slate-950 transition-colors">Booking Support</Link></li>
                <li><Link href="/refunds" className="hover:text-slate-950 transition-colors">Refunds & Claims</Link></li>
                <li><Link href="/visa" className="hover:text-slate-950 transition-colors">Travel Advisories</Link></li>
              </ul>
            </div>

            {/* Col 4: For Business */}
            <div>
              <p className="font-bold text-slate-950 uppercase tracking-wider text-[11px] mb-3">
                For Business
              </p>
              <ul className="space-y-2">
                <li><Link href="/corporate" className="hover:text-slate-950 transition-colors">Corporate Travel</Link></li>
                <li><Link href="/groups" className="hover:text-slate-950 transition-colors">Group Travel</Link></li>
                <li><Link href="/mice" className="hover:text-slate-950 transition-colors">Travel Agents</Link></li>
                <li><Link href="/dashboard" className="hover:text-slate-950 transition-colors">API Access</Link></li>
              </ul>
            </div>

            {/* Col 5: Social & Copyright */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 text-slate-600 mb-4">
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-slate-950 transition-colors">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
                    </svg>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-slate-950 transition-colors">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X" className="hover:text-slate-950 transition-colors">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:text-slate-950 transition-colors">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                </div>
                <p className="text-[11px] text-slate-600">
                  © {new Date().getFullYear()} FlightOne.<br />
                  All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
