"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import "./flights.css";

const AIRPORTS = [
  { city: "Lahore", code: "LHE" },
  { city: "Karachi", code: "KHI" },
  { city: "Islamabad", code: "ISB" },
  { city: "Dubai", code: "DXB" },
  { city: "London", code: "LHR" },
  { city: "Istanbul", code: "IST" },
  { city: "Bangkok", code: "BKK" },
  { city: "Jeddah", code: "JED" },
  { city: "New York", code: "JFK" },
  { city: "Tokyo", code: "HND" },
  { city: "Doha", code: "DOH" },
];

const POPULAR_DESTINATIONS = [
  {
    city: "Dubai",
    country: "United Arab Emirates",
    priceFrom: "PKR 88,500",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
    query: "Flights from Lahore to Dubai next week nonstop",
  },
  {
    city: "Istanbul",
    country: "Turkey",
    priceFrom: "PKR 142,000",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
    query: "Flights to Istanbul Turkey next month best fare",
  },
  {
    city: "London",
    country: "United Kingdom",
    priceFrom: "PKR 195,000",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
    query: "Roundtrip flights to London Heathrow for 1 adult in economy",
  },
  {
    city: "Bangkok",
    country: "Thailand",
    priceFrom: "PKR 76,000",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
    query: "Flights to Bangkok Thailand nonstop economy",
  },
];

const ROUTE_CHIPS = [
  { label: "Lahore → Dubai", from: "LHE", to: "DXB" },
  { label: "Lahore → Istanbul", from: "LHE", to: "IST" },
  { label: "Karachi → London", from: "KHI", to: "LHR" },
  { label: "Islamabad → Jeddah", from: "ISB", to: "JED" },
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Verified fares only",
    body: "Ava never invents a price. Every quote comes from a live supplier response.",
  },
  {
    icon: Wallet,
    title: "No hidden fees",
    body: "The fare you confirm is the fare you pay — taxes and surcharges shown upfront.",
  },
  {
    icon: Clock,
    title: "Live delay tracking",
    body: "Once ticketed, your flight moves to My Journey for real-time radar and rebooking help.",
  },
  {
    icon: Sparkles,
    title: "Hands-free booking",
    body: "Complete your traveller dossier once and Ava can book, ticket, and confirm for you.",
  },
];

export function FlightsPageClient() {
  const router = useRouter();
  const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");
  const [origin, setOrigin] = useState("LHE");
  const [destination, setDestination] = useState("DXB");
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
  const [passengers, setPassengers] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [clickedCity, setClickedCity] = useState<string | null>(null);

  function goToChat(query: string, city?: string) {
    setSubmitting(true);
    if (city) setClickedCity(city);
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query =
      tripType === "roundtrip" && returnDate
        ? `Roundtrip flights from ${origin} to ${destination} departing ${departureDate} returning ${returnDate} for ${passengers} passenger in economy`
        : `One-way flight from ${origin} to ${destination} departing ${departureDate} for ${passengers} passenger in economy`;
    goToChat(query);
  }

  return (
    <div className="fo-flights__master-stage">
      <div className="fo-flights__nav-rail">
        <span className="fo-flights__brand-badge">
          <span className="fo-flights__brand-dot" aria-hidden />
          Flights
        </span>
        <nav className="fo-flights__nav-tabs" aria-label="Explore">
          <Link href="/flights" className="fo-flights__nav-tab fo-flights__nav-tab--active">
            <Plane size={13} strokeWidth={2.2} aria-hidden />
            Flights
          </Link>
          <Link href="/stays" className="fo-flights__nav-tab">
            Stays
          </Link>
          <Link href="/cars" className="fo-flights__nav-tab">
            Cars
          </Link>
        </nav>
      </div>

      <div className="fo-flights__hero-showcase">
        <div className="fo-flights__hero-left">
          <div className="fo-flights__hero-eyebrow">
            <Plane size={13} strokeWidth={2.2} className="text-sky" />
            <span>Live fares, 1,000+ destinations</span>
          </div>

          <h1 className="fo-flights__hero-title">
            FLY ANYWHERE,
            <br />
            <span className="fo-flights__hero-title-accent">BOOKED BY AVA</span>
          </h1>

          <p className="fo-flights__hero-lede">
            Tell Ava where you&apos;re going. She searches live supplier fares, compares nonstop
            and connecting options, and books once you confirm — no invented prices, no silent
            charges.
          </p>

          <div className="fo-flights__feature-pills">
            <div className="fo-flights__feature-pill">
              <span className="fo-flights__feature-pill-dot" />
              <span>Verified live fares</span>
            </div>
            <div className="fo-flights__feature-pill">
              <span className="fo-flights__feature-pill-dot fo-flights__feature-pill-dot--emerald" />
              <span>Nonstop &amp; connecting</span>
            </div>
            <div className="fo-flights__feature-pill">
              <span className="fo-flights__feature-pill-dot fo-flights__feature-pill-dot--amber" />
              <span>Instant rebooking on delay</span>
            </div>
          </div>
        </div>

        <div className="fo-flights__hero-right">
          <div className="fo-flights__canvas-container">
            <div className="fo-flights__canvas-image" />
            <div className="fo-flights__canvas-tags">
              <span className="fo-flights__canvas-tag">
                <Plane size={12} strokeWidth={2.2} />
                Nonstop available
              </span>
              <span className="fo-flights__canvas-tag">
                <ShieldCheck size={12} strokeWidth={2.2} />
                Verified fares
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fo-flights__search-card">
        <form onSubmit={onSubmit} className="fo-flights__search-grid">
          <div className="fo-flights__field">
            <label className="fo-flights__field-label" htmlFor="flights-origin">
              From
            </label>
            <select
              id="flights-origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code})
                </option>
              ))}
            </select>
          </div>

          <div className="fo-flights__field">
            <label className="fo-flights__field-label" htmlFor="flights-destination">
              To
            </label>
            <select
              id="flights-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code})
                </option>
              ))}
            </select>
          </div>

          <div className="fo-flights__field">
            <label className="fo-flights__field-label" htmlFor="flights-depart">
              Depart
            </label>
            <input
              id="flights-depart"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
            />
          </div>

          <div className="fo-flights__field">
            <label className="fo-flights__field-label" htmlFor="flights-return">
              Return
            </label>
            <input
              id="flights-return"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={tripType === "oneway"}
              min={departureDate}
            />
          </div>

          <button type="submit" className="fo-flights__submit" disabled={submitting}>
            {submitting ? "Opening Ava…" : "Search with Ava"}
            {!submitting ? <ArrowRight size={15} strokeWidth={2.5} aria-hidden /> : null}
          </button>
        </form>

        <div className="fo-flights__route-chips">
          <label className="fo-flights__field-label" style={{ alignSelf: "center" }}>
            <input
              type="checkbox"
              checked={tripType === "oneway"}
              onChange={(e) => setTripType(e.target.checked ? "oneway" : "roundtrip")}
              style={{ marginRight: "0.4rem" }}
            />
            One-way
          </label>
          {ROUTE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="fo-flights__route-chip"
              onClick={() => {
                setOrigin(chip.from);
                setDestination(chip.to);
              }}
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            className="fo-flights__route-chip"
            onClick={() => setPassengers((p) => (p >= 6 ? 1 : p + 1))}
          >
            {passengers} passenger{passengers > 1 ? "s" : ""}
          </button>
        </div>
      </div>

      <section>
        <div className="fo-flights__section-head">
          <div>
            <h2 className="fo-flights__section-title">Popular this month</h2>
            <p className="fo-flights__section-lede">Fares shown are recent verified quotes, not guarantees.</p>
          </div>
        </div>
        <div className="fo-flights__destinations" style={{ marginTop: "1rem" }}>
          {POPULAR_DESTINATIONS.map((d) => (
            <button
              key={d.city}
              type="button"
              className="fo-flights__destination-card"
              disabled={submitting}
              onClick={() => goToChat(d.query, d.city)}
            >
              <div
                className="fo-flights__destination-image"
                style={{ backgroundImage: `url(${d.image})` }}
              />
              <div className="fo-flights__destination-scrim" />
              <div className="fo-flights__destination-body">
                <p className="fo-flights__destination-city">{d.city}</p>
                <p className="fo-flights__destination-meta">{d.country}</p>
                <p className="fo-flights__destination-price">
                  {clickedCity === d.city ? "Opening Ava…" : `From ${d.priceFrom}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="fo-flights__section-head">
          <div>
            <h2 className="fo-flights__section-title">Why book flights with Ava</h2>
          </div>
          <Link href="/chat" className="fo-flights__route-chip">
            <MessageCircle size={13} strokeWidth={2.2} />
            Chat with Ava
          </Link>
        </div>
        <div className="fo-flights__trust-strip" style={{ marginTop: "1rem" }}>
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="fo-flights__trust-card">
              <span className="fo-flights__trust-icon">
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
              <p className="fo-flights__trust-title">{title}</p>
              <p className="fo-flights__trust-body">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
