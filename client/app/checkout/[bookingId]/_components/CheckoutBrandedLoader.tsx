"use client";

import { Compass, Plane, ShieldCheck } from "lucide-react";

export interface CheckoutBrandedLoaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

export function CheckoutBrandedLoader({
  title = "Connecting to secure reservation systems…",
  subtitle = "Securing live inventory, fare locks & traveller credentials.",
  badge = "SECURE SESSION",
  className = "",
}: CheckoutBrandedLoaderProps) {
  return (
    <div
      className={`fo-checkout-loader ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${title} ${subtitle}`}
    >
      <div className="fo-checkout-loader__card">
        {/* Ambient radial glow background */}
        <div className="fo-checkout-loader__glow" aria-hidden />

        {/* Central Aerospace Orbital Beacon */}
        <div className="fo-checkout-loader__beacon-wrap" aria-hidden>
          {/* Concentric sonar radar rings */}
          <span className="fo-checkout-loader__ring fo-checkout-loader__ring--outer" />
          <span className="fo-checkout-loader__ring fo-checkout-loader__ring--mid" />
          <span className="fo-checkout-loader__scanner" />

          {/* Central cosmic orb */}
          <div className="fo-checkout-loader__orb">
            <Compass className="fo-checkout-loader__compass" />
            <div className="fo-checkout-loader__orbit">
              <Plane className="fo-checkout-loader__plane" />
            </div>
          </div>
        </div>

        {/* Brand Identity Headline */}
        <div className="fo-checkout-loader__brand">
          <div className="fo-checkout-loader__headline">
            <span className="fo-checkout-loader__brand-flight">FLIGHT</span>
            <span className="fo-checkout-loader__brand-one">ONE</span>
            <span className="fo-checkout-loader__brand-tag">AI-TOS</span>
          </div>

          <div className="fo-checkout-loader__badge">
            <ShieldCheck className="h-3 w-3 text-cyan-500" />
            <span>{badge}</span>
            <span className="fo-checkout-loader__dot" />
          </div>
        </div>

        {/* Loading Message & Status */}
        <div className="fo-checkout-loader__content">
          <h2 className="fo-checkout-loader__title">{title}</h2>
          <p className="fo-checkout-loader__subtitle">{subtitle}</p>
        </div>

        {/* Shimmer Progress Track */}
        <div className="fo-checkout-loader__progress-bar" aria-hidden>
          <div className="fo-checkout-loader__progress-fill" />
        </div>
      </div>
    </div>
  );
}
