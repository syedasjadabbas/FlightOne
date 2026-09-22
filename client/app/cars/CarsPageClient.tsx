"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Car,
  Fuel,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import "./cars.css";

const POPULAR_CITIES = [
  "Dubai Intl Airport (DXB)",
  "Istanbul Airport (IST)",
  "London Heathrow (LHR)",
  "Lahore (LHE)",
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Real supplier quotes only",
    body: "Ava checks live rental partners for your city and dates — she never guesses a price.",
  },
  {
    icon: Users,
    title: "Every trip size",
    body: "Compacts for a solo trip, SUVs and vans for the family — tell Ava what you need.",
  },
  {
    icon: Fuel,
    title: "Fuel & insurance clarity",
    body: "Ava confirms fuel policy and coverage before you commit to a booking.",
  },
  {
    icon: Sparkles,
    title: "One conversation, done",
    body: "Pick-up city, dates, and driver details — Ava handles the rest of the booking flow.",
  },
];

export function CarsPageClient() {
  const router = useRouter();
  const [city, setCity] = useState("Dubai Intl Airport (DXB)");
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [dropoffDate, setDropoffDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);

  function goToChat(query: string) {
    setSubmitting(true);
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = `Rental cars in ${city} from ${pickupDate} to ${dropoffDate}`;
    goToChat(query);
  }

  return (
    <div className="fo-cars__master-stage">
      <div className="fo-cars__nav-rail">
        <span className="fo-cars__brand-badge">
          <span className="fo-cars__brand-dot" aria-hidden />
          Cars
        </span>
        <nav className="fo-cars__nav-tabs" aria-label="Explore">
          <Link href="/flights" className="fo-cars__nav-tab">
            Flights
          </Link>
          <Link href="/stays" className="fo-cars__nav-tab">
            Stays
          </Link>
          <Link href="/cars" className="fo-cars__nav-tab fo-cars__nav-tab--active">
            <Car size={13} strokeWidth={2.2} aria-hidden />
            Cars
          </Link>
        </nav>
      </div>

      <div className="fo-cars__hero-showcase">
        <div className="fo-cars__hero-left">
          <div className="fo-cars__hero-eyebrow">
            <Car size={13} strokeWidth={2.2} className="text-sky" />
            <span>Car hire at 1,000+ destinations</span>
          </div>

          <h1 className="fo-cars__hero-title">
            DRIVE ANYWHERE,
            <br />
            <span className="fo-cars__hero-title-accent">ARRANGED BY AVA</span>
          </h1>

          <p className="fo-cars__hero-lede">
            Tell Ava your pick-up city and dates. She checks rental partner availability and
            walks you through the booking in chat — every quote is a real supplier rate.
          </p>

          <div className="fo-cars__feature-pills">
            <div className="fo-cars__feature-pill">
              <span className="fo-cars__feature-pill-dot" />
              <span>Real supplier quotes</span>
            </div>
            <div className="fo-cars__feature-pill">
              <span className="fo-cars__feature-pill-dot fo-cars__feature-pill-dot--emerald" />
              <span>Compact to SUV</span>
            </div>
            <div className="fo-cars__feature-pill">
              <span className="fo-cars__feature-pill-dot fo-cars__feature-pill-dot--amber" />
              <span>Booked in chat</span>
            </div>
          </div>
        </div>

        <div className="fo-cars__hero-right">
          <div className="fo-cars__canvas-container">
            <div className="fo-cars__canvas-image" />
            <div className="fo-cars__canvas-tags">
              <span className="fo-cars__canvas-tag">
                <Car size={12} strokeWidth={2.2} />
                Airport pick-up
              </span>
              <span className="fo-cars__canvas-tag">
                <ShieldCheck size={12} strokeWidth={2.2} />
                Insurance clarity
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fo-cars__search-card">
        <form onSubmit={onSubmit} className="fo-cars__search-grid">
          <div className="fo-cars__field" style={{ gridColumn: "span 2" }}>
            <label className="fo-cars__field-label" htmlFor="cars-city">
              Pick-up location
            </label>
            <input
              id="cars-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City or airport"
              required
            />
          </div>

          <div className="fo-cars__field">
            <label className="fo-cars__field-label" htmlFor="cars-pickup">
              Pick-up date
            </label>
            <input
              id="cars-pickup"
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              required
            />
          </div>

          <div className="fo-cars__field">
            <label className="fo-cars__field-label" htmlFor="cars-dropoff">
              Drop-off date
            </label>
            <input
              id="cars-dropoff"
              type="date"
              value={dropoffDate}
              onChange={(e) => setDropoffDate(e.target.value)}
              min={pickupDate}
              required
            />
          </div>

          <button type="submit" className="fo-cars__submit" disabled={submitting}>
            {submitting ? "Opening Ava…" : "Ask Ava"}
            {!submitting ? <ArrowRight size={15} strokeWidth={2.5} aria-hidden /> : null}
          </button>
        </form>

        <div className="fo-cars__route-chips">
          {POPULAR_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              className="fo-cars__route-chip"
              onClick={() => setCity(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section>
        <div className="fo-cars__section-head">
          <div>
            <h2 className="fo-cars__section-title">Why arrange car hire with Ava</h2>
            <p className="fo-cars__section-lede">
              Car hire is a live chat handoff today, not a self-serve listing page — this keeps
              every quote honest to what a rental partner actually offers.
            </p>
          </div>
          <Link href="/chat" className="fo-cars__route-chip">
            <MessageCircle size={13} strokeWidth={2.2} />
            Chat with Ava
          </Link>
        </div>
        <div className="fo-cars__trust-strip" style={{ marginTop: "1rem" }}>
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="fo-cars__trust-card">
              <span className="fo-cars__trust-icon">
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
              <p className="fo-cars__trust-title">{title}</p>
              <p className="fo-cars__trust-body">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
