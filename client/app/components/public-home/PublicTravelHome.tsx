"use client";

import { useState, useId, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";

type TabType = "flights" | "stays";
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
  { city: "Karachi", code: "KHI", country: "Pakistan", airport: "Jinnah Intl" },
  { city: "Islamabad", code: "ISB", country: "Pakistan", airport: "Islamabad Intl" },
  { city: "Dubai", code: "DXB", country: "United Arab Emirates", airport: "Dubai Intl" },
  { city: "London", code: "LHR", country: "United Kingdom", airport: "Heathrow" },
  { city: "Istanbul", code: "IST", country: "Turkey", airport: "Istanbul Airport" },
  { city: "Bangkok", code: "BKK", country: "Thailand", airport: "Suvarnabhumi" },
  { city: "Jeddah", code: "JED", country: "Saudi Arabia", airport: "King Abdulaziz Intl" },
  { city: "New York", code: "JFK", country: "United States", airport: "John F. Kennedy" },
  { city: "Tokyo", code: "HND", country: "Japan", airport: "Haneda Airport" },
  { city: "San Francisco", code: "SFO", country: "United States", airport: "San Francisco Intl" },
  { city: "Doha", code: "DOH", country: "Qatar", airport: "Hamad Intl" },
];

const TRENDING_ROUTES = [
  {
    city: "Dubai",
    country: "United Arab Emirates",
    code: "DXB",
    pricePkr: "PKR 88,500",
    flightDuration: "3h 30m Direct",
    airline: "Emirates • FlyDubai",
    tag: "Popular Choice",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
    query: "Flights from Lahore to Dubai next week nonstop",
  },
  {
    city: "Istanbul",
    country: "Turkey",
    code: "IST",
    pricePkr: "PKR 142,000",
    flightDuration: "5h 45m Direct",
    airline: "Turkish Airlines • Pegasus",
    tag: "Historic Gateway",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
    query: "Flights to Istanbul Turkey next month best fare",
  },
  {
    city: "London",
    country: "United Kingdom",
    code: "LHR",
    pricePkr: "PKR 195,000",
    flightDuration: "9h 15m 1-Stop",
    airline: "British Airways • Qatar Airways",
    tag: "Trending",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
    query: "Roundtrip flights to London Heathrow for 1 adult in economy",
  },
  {
    city: "Bangkok",
    country: "Thailand",
    code: "BKK",
    pricePkr: "PKR 118,000",
    flightDuration: "5h 10m Direct",
    airline: "Thai Airways • Emirates",
    tag: "Tropical Getaway",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
    query: "Cheapest flights to Bangkok Thailand next month",
  },
  {
    city: "Jeddah",
    country: "Saudi Arabia",
    code: "JED",
    pricePkr: "PKR 92,000",
    flightDuration: "4h 45m Direct",
    airline: "Saudia • Airblue",
    tag: "Direct Access",
    image: "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?auto=format&fit=crop&w=600&q=80",
    query: "Direct flights to Jeddah Saudi Arabia",
  },
  {
    city: "Tokyo",
    country: "Japan",
    code: "HND",
    pricePkr: "PKR 245,000",
    flightDuration: "11h 20m 1-Stop",
    airline: "Qatar Airways • Emirates",
    tag: "Cultural Wonder",
    image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
    query: "Best flights to Tokyo Japan next season",
  },
];

const FEATURED_STAYS = [
  {
    name: "Atlantis The Royal",
    location: "Palm Jumeirah, Dubai",
    rating: "4.9",
    reviews: 1420,
    priceNight: "PKR 165,000",
    badge: "5-Star Ultra Luxury",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
    query: "Hotels in Dubai Palm Jumeirah luxury resort with breakfast",
  },
  {
    name: "The Ritz-Carlton Istanbul",
    location: "Bosphorus View, Istanbul",
    rating: "4.8",
    reviews: 980,
    priceNight: "PKR 95,000",
    badge: "Heritage & Spa",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    query: "5-star hotels in Istanbul near Bosphorus with sea view",
  },
  {
    name: "The Langham, London",
    location: "Regent Street, London",
    rating: "4.9",
    reviews: 2150,
    priceNight: "PKR 185,000",
    badge: "Central Historic",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    query: "Luxury hotels in London central near Regent Street",
  },
  {
    name: "Banyan Tree Bangkok",
    location: "Sathorn Skyline, Bangkok",
    rating: "4.8",
    reviews: 1240,
    priceNight: "PKR 48,000",
    badge: "Rooftop Oasis",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    query: "Hotels in Bangkok with rooftop pool and breakfast",
  },
];

export function PublicTravelHome() {
  const router = useRouter();

  // Search state
  const [tab, setTab] = useState<TabType>("flights");
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [passengerDropdownOpen, setPassengerDropdownOpen] = useState(false);

  // Locations
  const [origin, setOrigin] = useState("LHE");
  const [originText, setOriginText] = useState("Lahore (LHE)");
  const [originOpen, setOriginOpen] = useState(false);

  const [destination, setDestination] = useState("DXB");
  const [destinationText, setDestinationText] = useState("Dubai (DXB)");
  const [destinationOpen, setDestinationOpen] = useState(false);

  // Stays location
  const [stayCity, setStayCity] = useState("Dubai, UAE");

  // Dates: default departure = +7 days, return = +14 days
  const todayStr = new Date().toISOString().slice(0, 10);
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const passengerRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (passengerRef.current && !passengerRef.current.contains(e.target as Node)) {
        setPassengerDropdownOpen(false);
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
  const handleSwap = () => {
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

  const handlePromptClick = (promptText: string) => {
    router.push(`/chat?q=${encodeURIComponent(promptText)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#071320] text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Chrome Navigation */}
      <SiteNav />

      {/* ── Search Hero Section ── */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-slate-800/80">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-cyan-600/15 via-sky-600/5 to-transparent blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Eyebrow & Headline */}
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3 tracking-wide uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Autonomous Travel Operating System
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Where do you want to fly <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">next?</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Search live global airline inventories and curated stays without signing in. Transparent fares, smart AI consultation, and verified routes.
            </p>
          </div>

          {/* ── Search Widget Container (Kayak-style elevated workspace) ── */}
          <div className="bg-[#0b1b2d]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 sm:p-6 transition-all duration-200">
            {/* Top Toolbar: Mode Switcher & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80">
              {/* Tabs: Flights vs Stays */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTab("flights")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    tab === "flights"
                      ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                      : "text-slate-400 hover:text-white"
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
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    tab === "stays"
                      ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Stays & Hotels
                </button>
              </div>

              {/* Sub-selectors: Trip type & Passengers (for flights) */}
              {tab === "flights" && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Trip Type Selector */}
                  <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setTripType("roundtrip")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        tripType === "roundtrip" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Roundtrip
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripType("oneway")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        tripType === "oneway" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      One-way
                    </button>
                  </div>

                  {/* Passengers & Cabin Dropdown */}
                  <div className="relative" ref={passengerRef}>
                    <button
                      type="button"
                      onClick={() => setPassengerDropdownOpen(!passengerDropdownOpen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 text-slate-200 rounded-lg border border-slate-800 text-xs font-medium transition-colors"
                    >
                      <span>
                        {adults + children} Traveler{adults + children > 1 ? "s" : ""},{" "}
                        {cabinClass === "business" ? "Business" : cabinClass === "first" ? "First" : cabinClass === "premium_economy" ? "Prem. Econ" : "Economy"}
                      </span>
                      <svg className={`h-3 w-3 text-slate-400 transition-transform ${passengerDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Passenger Popover */}
                    {passengerDropdownOpen && (
                      <div className="absolute right-0 sm:left-0 top-full mt-2 w-64 p-3.5 bg-[#091b2e] border border-slate-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 text-xs">
                        <div className="space-y-3 pb-3 border-b border-slate-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white">Adults</p>
                              <p className="text-[11px] text-slate-400">Age 12+</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={adults <= 1}
                                onClick={() => setAdults(Math.max(1, adults - 1))}
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 hover:bg-slate-800"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-bold text-white">{adults}</span>
                              <button
                                type="button"
                                disabled={adults >= 9}
                                onClick={() => setAdults(adults + 1)}
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 hover:bg-slate-800"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white">Children</p>
                              <p className="text-[11px] text-slate-400">Age 2–11</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={children <= 0}
                                onClick={() => setChildren(Math.max(0, children - 1))}
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 hover:bg-slate-800"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-bold text-white">{children}</span>
                              <button
                                type="button"
                                disabled={children >= 8}
                                onClick={() => setChildren(children + 1)}
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 hover:bg-slate-800"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                            Cabin Class
                          </label>
                          <select
                            value={cabinClass}
                            onChange={(e) => setCabinClass(e.target.value as CabinClass)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value="economy">Economy</option>
                            <option value="premium_economy">Premium Economy</option>
                            <option value="business">Business Class</option>
                            <option value="first">First Class</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Main Search Form (Flights) ── */}
            {tab === "flights" ? (
              <form onSubmit={handleFlightSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                  {/* Origin Field */}
                  <div className="md:col-span-4 relative" ref={originRef}>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      From (Origin)
                    </label>
                    <div
                      onClick={() => setOriginOpen(!originOpen)}
                      className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-slate-600 transition-colors"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-cyan-400 font-bold text-xs shrink-0">
                        {origin}
                      </div>
                      <span className="text-sm font-semibold text-white truncate flex-1">
                        {originText}
                      </span>
                    </div>

                    {/* Origin Autocomplete Popover */}
                    {originOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#091b2e] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Select Departure Airport
                        </p>
                        {POPULAR_AIRPORTS.map((air) => (
                          <div
                            key={`orig-${air.code}`}
                            onClick={() => {
                              setOrigin(air.code);
                              setOriginText(`${air.city} (${air.code})`);
                              setOriginOpen(false);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-white">{air.city}, {air.country}</p>
                              <p className="text-[10px] text-slate-400">{air.airport}</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-400">{air.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Swap Button (Centrally aligned on desktop) */}
                  <div className="hidden md:flex md:col-span-1 justify-center pt-5">
                    <button
                      type="button"
                      onClick={handleSwap}
                      aria-label="Swap origin and destination"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition-all active:scale-95"
                    >
                      ⇄
                    </button>
                  </div>

                  {/* Destination Field */}
                  <div className="md:col-span-4 relative" ref={destinationRef}>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      To (Destination)
                    </label>
                    <div
                      onClick={() => setDestinationOpen(!destinationOpen)}
                      className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-slate-600 transition-colors"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-sky-400 font-bold text-xs shrink-0">
                        {destination}
                      </div>
                      <span className="text-sm font-semibold text-white truncate flex-1">
                        {destinationText}
                      </span>
                    </div>

                    {/* Destination Autocomplete Popover */}
                    {destinationOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#091b2e] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Popular Destinations
                        </p>
                        {POPULAR_AIRPORTS.filter((a) => a.code !== origin).map((air) => (
                          <div
                            key={`dest-${air.code}`}
                            onClick={() => {
                              setDestination(air.code);
                              setDestinationText(`${air.city} (${air.code})`);
                              setDestinationOpen(false);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-white">{air.city}, {air.country}</p>
                              <p className="text-[10px] text-slate-400">{air.airport}</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-sky-400">{air.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dates & CTA */}
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Departure {tripType === "roundtrip" ? "& Return" : ""}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        min={todayStr}
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      {tripType === "roundtrip" && (
                        <input
                          type="date"
                          min={departureDate || todayStr}
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button Row */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Live airline search across Travelport GDS & 400+ carriers</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Flights
                  </button>
                </div>
              </form>
            ) : (
              /* ── Stays Search Form ── */
              <form onSubmit={handleStaySearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      City, Destination, or Hotel Name
                    </label>
                    <input
                      type="text"
                      value={stayCity}
                      onChange={(e) => setStayCity(e.target.value)}
                      placeholder="e.g. Dubai, Istanbul, London, Bangkok"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Check-in & Check-out Dates
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        min={todayStr}
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <input
                        type="date"
                        min={departureDate || todayStr}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Real-time rates and curated boutique & luxury properties</span>
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Stays
                  </button>
                </div>
              </form>
            )}

            {/* Quick AI Consultant Prompt Chips */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
                <span className="text-cyan-400">✨</span> Ask Ava:
              </span>
              <button
                type="button"
                onClick={() => handlePromptClick("Cheapest nonstop flight to Dubai next weekend")}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors"
              >
                Cheapest flight to Dubai next weekend
              </button>
              <button
                type="button"
                onClick={() => handlePromptClick("Best flights Karachi to London Heathrow under $700")}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors"
              >
                Karachi to London under $700
              </button>
              <button
                type="button"
                onClick={() => handlePromptClick("4-star boutique hotels in Istanbul near Taksim with breakfast")}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors"
              >
                4-star hotel in Istanbul near Taksim
              </button>
              <button
                type="button"
                onClick={() => handlePromptClick("Roundtrip Islamabad to Jeddah next month for 2 passengers")}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors"
              >
                Islamabad to Jeddah for 2
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trending Flight Deals (Bento Grid) ── */}
      <section className="py-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Live Fare Radar
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Popular Routes & Estimated Fares
            </h2>
          </div>
          <Link
            href="/chat"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 group"
          >
            Explore all global destinations <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRENDING_ROUTES.map((route) => (
            <div
              key={route.code}
              className="group relative bg-[#0b1b2d] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-cyan-500/5 transition-all flex flex-col"
            >
              {/* Destination Image */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                <img
                  src={route.image}
                  alt={route.city}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1b2d] via-transparent to-black/20" />
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10.5px] font-bold text-cyan-300">
                  {route.tag}
                </span>
                <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded bg-slate-900/90 text-xs font-mono font-bold text-white border border-slate-700/80">
                  {route.code}
                </span>
              </div>

              {/* Details & CTA */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {route.city}
                    </h3>
                    <span className="text-sm font-extrabold text-cyan-400">{route.pricePkr}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{route.country}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 py-1.5 border-t border-slate-800/80">
                    <span>{route.flightDuration}</span>
                    <span className="truncate max-w-[150px] text-right">{route.airline}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePromptClick(route.query)}
                  className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Search Route</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Stays & Suites ── */}
      <section className="py-12 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Curated Accommodations
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Handpicked Stays & Suites
              </h2>
            </div>
            <Link
              href="/chat"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 group"
            >
              Ask Ava for hotel recommendations <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURED_STAYS.map((stay) => (
              <div
                key={stay.name}
                className="group bg-[#0b1b2d] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col"
              >
                <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                  <img
                    src={stay.image}
                    alt={stay.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1b2d] via-transparent to-transparent" />
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-sky-300 border border-slate-800">
                    {stay.badge}
                  </span>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white truncate mb-0.5">{stay.name}</h3>
                    <p className="text-[11px] text-slate-400 truncate mb-2">{stay.location}</p>
                    <div className="flex items-center justify-between text-xs py-1 border-t border-slate-800/80">
                      <span className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                        ★ {stay.rating} <span className="text-slate-400 font-normal text-[10.5px]">({stay.reviews})</span>
                      </span>
                      <span className="font-bold text-white text-xs">{stay.priceNight}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePromptClick(stay.query)}
                    className="mt-3 w-full py-1.5 px-2 rounded-lg bg-slate-800/70 hover:bg-sky-500 hover:text-slate-950 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all text-center"
                  >
                    View Property
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value Proposition: Why FlightOne? ── */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Why Travelers Choose FlightOne
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Engineered for transparency, direct inventory access, and seamless travel logistics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#0b1b2d] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Direct GDS & NDC Rates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect directly with global airlines. Compare pure net fares with zero undisclosed markups or hidden fees.
            </p>
          </div>

          <div className="bg-[#0b1b2d] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Ava AI Consultant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plan complex multi-city trips in natural language. Ava checks layover buffers, baggage rules, and hotel proximity.
            </p>
          </div>

          <div className="bg-[#0b1b2d] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Encrypted Travel Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Store passports, visas, and receipts in your secure vault. Automatic passport validity and visa held checks prior to ticketing.
            </p>
          </div>

          <div className="bg-[#0b1b2d] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">24/7 Human Escalation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Need certified agent assistance? Seamless handoff with complete conversational context preserved for human consultants.
            </p>
          </div>
        </div>
      </section>

      {/* ── Specialized Services Grid ── */}
      <section className="py-12 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/corporate"
              className="p-4 rounded-xl bg-[#0b1b2d] border border-slate-800 hover:border-cyan-500/50 transition-colors group"
            >
              <div className="text-cyan-400 font-bold text-sm mb-1 group-hover:text-cyan-300">
                Corporate Travel Desk →
              </div>
              <p className="text-xs text-slate-400">
                Company policies, cost centers, and credit billing.
              </p>
            </Link>

            <Link
              href="/groups"
              className="p-4 rounded-xl bg-[#0b1b2d] border border-slate-800 hover:border-cyan-500/50 transition-colors group"
            >
              <div className="text-cyan-400 font-bold text-sm mb-1 group-hover:text-cyan-300">
                Group Travel (10+) →
              </div>
              <p className="text-xs text-slate-400">
                Bulk passenger coordination and dedicated group ticketing.
              </p>
            </Link>

            <Link
              href="/visa"
              className="p-4 rounded-xl bg-[#0b1b2d] border border-slate-800 hover:border-cyan-500/50 transition-colors group"
            >
              <div className="text-cyan-400 font-bold text-sm mb-1 group-hover:text-cyan-300">
                Visa Intelligence →
              </div>
              <p className="text-xs text-slate-400">
                Destination entry requirements and held visa audits.
              </p>
            </Link>

            <Link
              href="/refunds"
              className="p-4 rounded-xl bg-[#0b1b2d] border border-slate-800 hover:border-cyan-500/50 transition-colors group"
            >
              <div className="text-cyan-400 font-bold text-sm mb-1 group-hover:text-cyan-300">
                Refunds & Claims →
              </div>
              <p className="text-xs text-slate-400">
                Disruption management, airline penalties, and credit status.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto py-8 bg-[#050e18] border-t border-slate-800/80 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">FlightOne</span>
            <span>© {new Date().getFullYear()} Autonomous Travel Operating System.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link href="/chat" className="hover:text-white transition-colors">AI Consultant</Link>
            <Link href="/journey" className="hover:text-white transition-colors">Journey</Link>
            <Link href="/more" className="hover:text-white transition-colors">Platform Hub</Link>
            <Link href="/login" className="hover:text-white transition-colors">Staff Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
