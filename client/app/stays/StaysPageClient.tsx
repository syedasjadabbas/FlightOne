"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import "./stays.css";

const FEATURED_STAYS = [
  {
    name: "Atlantis The Royal",
    location: "Dubai, UAE",
    rating: "4.9",
    priceFrom: "PKR 185,000",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
    query: "Hotels in Dubai Palm Jumeirah luxury resort with breakfast",
  },
  {
    name: "Ritz-Carlton",
    location: "Istanbul, Turkey",
    rating: "4.8",
    priceFrom: "PKR 85,000",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    query: "5-star hotels in Istanbul near Bosphorus with sea view",
  },
  {
    name: "The Langham",
    location: "London, UK",
    rating: "4.9",
    priceFrom: "PKR 185,000",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    query: "Luxury hotels in London central near Regent Street",
  },
  {
    name: "Banyan Tree",
    location: "Bangkok, Thailand",
    rating: "4.8",
    priceFrom: "PKR 48,000",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    query: "Hotels in Bangkok with rooftop pool and breakfast",
  },
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Verified availability",
    body: "Ava checks live supplier inventory before quoting a rate — nothing is guessed.",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    body: "Nightly rate, taxes, and resort fees are shown before you confirm anything.",
  },
  {
    icon: BedDouble,
    title: "Every room type",
    body: "Hotels, villas, resorts, and serviced apartments — Ava matches the stay to your trip.",
  },
  {
    icon: Sparkles,
    title: "Booked in one chat",
    body: "Tell Ava your dates and guests once. She holds the details for your next stay too.",
  },
];

export function StaysPageClient() {
  const router = useRouter();
  const [destination, setDestination] = useState("Dubai, UAE");
  const [checkIn, setCheckIn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [guests, setGuests] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [clickedStay, setClickedStay] = useState<string | null>(null);

  function goToChat(query: string, stayName?: string) {
    setSubmitting(true);
    if (stayName) setClickedStay(stayName);
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = `Hotels in ${destination} checking in ${checkIn} checking out ${checkOut} for ${guests} guests`;
    goToChat(query);
  }

  return (
    <div className="fo-stays__master-stage">
      <div className="fo-stays__nav-rail">
        <span className="fo-stays__brand-badge">
          <span className="fo-stays__brand-dot" aria-hidden />
          Stays
        </span>
        <nav className="fo-stays__nav-tabs" aria-label="Explore">
          <Link href="/flights" className="fo-stays__nav-tab">
            Flights
          </Link>
          <Link href="/stays" className="fo-stays__nav-tab fo-stays__nav-tab--active">
            <BedDouble size={13} strokeWidth={2.2} aria-hidden />
            Stays
          </Link>
          <Link href="/cars" className="fo-stays__nav-tab">
            Cars
          </Link>
        </nav>
      </div>

      <div className="fo-stays__hero-showcase">
        <div className="fo-stays__hero-left">
          <div className="fo-stays__hero-eyebrow">
            <BedDouble size={13} strokeWidth={2.2} className="text-sky" />
            <span>Hotels, villas &amp; resorts worldwide</span>
          </div>

          <h1 className="fo-stays__hero-title">
            STAY ANYWHERE,
            <br />
            <span className="fo-stays__hero-title-accent">BOOKED BY AVA</span>
          </h1>

          <p className="fo-stays__hero-lede">
            Tell Ava your destination and dates. She checks live availability across hotels,
            villas, and resorts, and books once you confirm — real rates, no invented listings.
          </p>

          <div className="fo-stays__feature-pills">
            <div className="fo-stays__feature-pill">
              <span className="fo-stays__feature-pill-dot" />
              <span>Live availability</span>
            </div>
            <div className="fo-stays__feature-pill">
              <span className="fo-stays__feature-pill-dot fo-stays__feature-pill-dot--emerald" />
              <span>Hotels to villas</span>
            </div>
            <div className="fo-stays__feature-pill">
              <span className="fo-stays__feature-pill-dot fo-stays__feature-pill-dot--amber" />
              <span>Transparent nightly rate</span>
            </div>
          </div>
        </div>

        <div className="fo-stays__hero-right">
          <div className="fo-stays__canvas-container">
            <div className="fo-stays__canvas-image" />
            <div className="fo-stays__canvas-tags">
              <span className="fo-stays__canvas-tag">
                <BedDouble size={12} strokeWidth={2.2} />
                4,000+ properties
              </span>
              <span className="fo-stays__canvas-tag">
                <ShieldCheck size={12} strokeWidth={2.2} />
                Verified rates
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fo-stays__search-card">
        <form onSubmit={onSubmit} className="fo-stays__search-grid">
          <div className="fo-stays__field" style={{ gridColumn: "span 2" }}>
            <label className="fo-stays__field-label" htmlFor="stays-destination">
              Destination or property
            </label>
            <input
              id="stays-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="City, hotel, or area"
              required
            />
          </div>

          <div className="fo-stays__field">
            <label className="fo-stays__field-label" htmlFor="stays-checkin">
              Check-in
            </label>
            <input
              id="stays-checkin"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
            />
          </div>

          <div className="fo-stays__field">
            <label className="fo-stays__field-label" htmlFor="stays-checkout">
              Check-out
            </label>
            <input
              id="stays-checkout"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn}
              required
            />
          </div>

          <button type="submit" className="fo-stays__submit" disabled={submitting}>
            {submitting ? "Opening Ava…" : "Search with Ava"}
            {!submitting ? <ArrowRight size={15} strokeWidth={2.5} aria-hidden /> : null}
          </button>
        </form>

        <div className="fo-stays__route-chips">
          <button
            type="button"
            className="fo-stays__route-chip"
            onClick={() => setGuests((g) => (g >= 6 ? 1 : g + 1))}
          >
            {guests} guest{guests > 1 ? "s" : ""}
          </button>
          {FEATURED_STAYS.slice(0, 3).map((s) => (
            <button
              key={s.name}
              type="button"
              className="fo-stays__route-chip"
              onClick={() => setDestination(s.location)}
            >
              {s.location}
            </button>
          ))}
        </div>
      </div>

      <section>
        <div className="fo-stays__section-head">
          <div>
            <h2 className="fo-stays__section-title">Featured stays</h2>
            <p className="fo-stays__section-lede">Rates shown are recent verified quotes, not guarantees.</p>
          </div>
        </div>
        <div className="fo-stays__destinations" style={{ marginTop: "1rem" }}>
          {FEATURED_STAYS.map((s) => (
            <button
              key={s.name}
              type="button"
              className="fo-stays__destination-card"
              disabled={submitting}
              onClick={() => goToChat(s.query, s.name)}
            >
              <div
                className="fo-stays__destination-image"
                style={{ backgroundImage: `url(${s.image})` }}
              />
              <div className="fo-stays__destination-scrim" />
              <span className="fo-stays__destination-rating">
                <Star size={11} strokeWidth={2.5} fill="currentColor" />
                {s.rating}
              </span>
              <div className="fo-stays__destination-body">
                <p className="fo-stays__destination-city">{s.name}</p>
                <p className="fo-stays__destination-meta">{s.location}</p>
                <p className="fo-stays__destination-price">
                  {clickedStay === s.name ? "Opening Ava…" : `From ${s.priceFrom}/night`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="fo-stays__section-head">
          <div>
            <h2 className="fo-stays__section-title">Why book stays with Ava</h2>
          </div>
          <Link href="/chat" className="fo-stays__route-chip">
            <MessageCircle size={13} strokeWidth={2.2} />
            Chat with Ava
          </Link>
        </div>
        <div className="fo-stays__trust-strip" style={{ marginTop: "1rem" }}>
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="fo-stays__trust-card">
              <span className="fo-stays__trust-icon">
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
              <p className="fo-stays__trust-title">{title}</p>
              <p className="fo-stays__trust-body">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
