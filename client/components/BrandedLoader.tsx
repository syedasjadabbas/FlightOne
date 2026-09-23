"use client";

import { Compass, Plane, ShieldCheck, type LucideIcon } from "lucide-react";

export interface BrandedLoaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  centerIcon?: LucideIcon;
  orbitIcon?: LucideIcon;
}

export function BrandedLoader({
  title = "Connecting to secure reservation systems…",
  subtitle = "Securing live inventory, fare locks & traveller credentials.",
  badge = "SECURE SESSION",
  className = "",
  centerIcon: CenterIcon = Compass,
  orbitIcon: OrbitIcon = Plane,
}: BrandedLoaderProps) {
  return (
    <div
      className={`fo-branded-loader fo-checkout-loader ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${title} ${subtitle}`}
    >
      <div className="fo-branded-loader__card fo-checkout-loader__card">
        {/* Ambient radial glow background */}
        <div className="fo-branded-loader__glow fo-checkout-loader__glow" aria-hidden />

        {/* Central Aerospace Orbital Beacon */}
        <div className="fo-branded-loader__beacon-wrap fo-checkout-loader__beacon-wrap" aria-hidden>
          {/* Concentric sonar radar rings */}
          <span className="fo-branded-loader__ring fo-branded-loader__ring--outer fo-checkout-loader__ring fo-checkout-loader__ring--outer" />
          <span className="fo-branded-loader__ring fo-branded-loader__ring--mid fo-checkout-loader__ring fo-checkout-loader__ring--mid" />
          <span className="fo-branded-loader__scanner fo-checkout-loader__scanner" />

          {/* Central cosmic orb */}
          <div className="fo-branded-loader__orb fo-checkout-loader__orb">
            <CenterIcon className="fo-branded-loader__compass fo-checkout-loader__compass" />
            <div className="fo-branded-loader__orbit fo-checkout-loader__orbit">
              <OrbitIcon className="fo-branded-loader__plane fo-checkout-loader__plane" />
            </div>
          </div>
        </div>

        {/* Brand Identity Headline */}
        <div className="fo-branded-loader__brand fo-checkout-loader__brand">
          <div className="fo-branded-loader__headline fo-checkout-loader__headline">
            <span className="fo-branded-loader__brand-flight fo-checkout-loader__brand-flight">FLIGHT</span>
            <span className="fo-branded-loader__brand-one fo-checkout-loader__brand-one">ONE</span>
            <span className="fo-branded-loader__brand-tag fo-checkout-loader__brand-tag">AI-TOS</span>
          </div>

          <div className="fo-branded-loader__badge fo-checkout-loader__badge">
            <ShieldCheck className="h-3 w-3 text-cyan-500" />
            <span>{badge}</span>
            <span className="fo-branded-loader__dot fo-checkout-loader__dot" />
          </div>
        </div>

        {/* Loading Message & Status */}
        <div className="fo-branded-loader__content fo-checkout-loader__content">
          <h2 className="fo-branded-loader__title fo-checkout-loader__title">{title}</h2>
          <p className="fo-branded-loader__subtitle fo-checkout-loader__subtitle">{subtitle}</p>
        </div>

        {/* Shimmer Progress Track */}
        <div className="fo-branded-loader__progress-bar fo-checkout-loader__progress-bar" aria-hidden>
          <div className="fo-branded-loader__progress-fill fo-checkout-loader__progress-fill" />
        </div>
      </div>
    </div>
  );
}

export { BrandedLoader as CheckoutBrandedLoader };
export type { BrandedLoaderProps as CheckoutBrandedLoaderProps };
