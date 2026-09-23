/**
 * FlightOne travel visual system — doodles + soft 3D product objects.
 * Decorative only. Call sites should keep aria-hidden on compositions.
 */

type DoodleProps = {
  className?: string;
  size?: number;
};

const stroke = "currentColor";

/* ── Line doodles ─────────────────────────────────────────────── */

export function DoodlePlane({ className, size = 48 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M8 32c12-2 20-8 28-14l4-2 2 6-6 4c-4 8-10 14-18 18l-6 2 2-6 4-8Z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M36 18l8 6M44 24l6-2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DoodlePlaneMini({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12c4-.5 7-2.5 10-5l1.5-.8.8 2.5-2.5 1.5c-1.5 3-3.5 5.5-6 7l-2.5.8.8-2.5 1.9-3.5Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleRoutePath({ className, size = 120 }: DoodleProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.35}
      viewBox="0 0 120 42"
      fill="none"
      aria-hidden
    >
      <path
        className="fo-doodle-route-path"
        d="M4 28 C 28 8, 52 36, 76 18 S 108 12, 116 20"
        stroke={stroke}
        strokeWidth="1.6"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
      <circle cx="4" cy="28" r="3" fill={stroke} opacity="0.5" />
      <circle cx="116" cy="20" r="3" fill={stroke} opacity="0.85" />
    </svg>
  );
}

export function DoodlePin({ className, size = 28 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 4c-4.5 0-8 3.2-8 7.5 0 5.5 8 14.5 8 14.5s8-9 8-14.5C24 7.2 20.5 4 16 4Z"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="11.5" r="2.5" stroke={stroke} strokeWidth="1.4" />
    </svg>
  );
}

export function DoodleGlobe({ className, size = 36 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="14" stroke={stroke} strokeWidth="1.6" />
      <ellipse cx="20" cy="20" rx="6" ry="14" stroke={stroke} strokeWidth="1.2" opacity="0.7" />
      <path d="M6 20h28M8 13h24M8 27h24" stroke={stroke} strokeWidth="1" opacity="0.45" />
    </svg>
  );
}

export function DoodleStamp({ className, size = 40 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect
        x="8"
        y="10"
        width="32"
        height="28"
        rx="3"
        stroke={stroke}
        strokeWidth="1.6"
        strokeDasharray="3 3"
      />
      <path
        d="M14 18h20M14 24h14M14 30h10"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function DoodleLuggage({ className, size = 32 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect x="8" y="14" width="20" height="16" rx="2" stroke={stroke} strokeWidth="1.6" />
      <path d="M14 14V11a4 4 0 0 1 8 0v3" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 22h20" stroke={stroke} strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

export function DoodleTicket({ className, size = 40 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size * 0.55} viewBox="0 0 56 32" fill="none" aria-hidden>
      <path
        d="M4 6h36a4 4 0 0 1 4 4v2a3 3 0 1 0 0 8v2a4 4 0 0 1-4 4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 6v20" stroke={stroke} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.55" />
      <path d="M22 12h14M22 17h10" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

export function DoodleBoardingPass({ className, size = 44 }: DoodleProps) {
  return (
    <svg className={className} width={size} height={size * 0.7} viewBox="0 0 56 40" fill="none" aria-hidden>
      <rect x="4" y="6" width="48" height="28" rx="3" stroke={stroke} strokeWidth="1.5" />
      <path d="M4 18h48" stroke={stroke} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.5" />
      <circle cx="14" cy="12" r="2.5" stroke={stroke} strokeWidth="1.2" />
      <path d="M22 11h18M22 15h12" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M10 24h12M10 28h8" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <path
        d="M38 26c2-.3 3.5-1.2 5-2.4l.8-.4.4 1.2-1.2.8c-.8 1.4-1.8 2.6-3.2 3.4l-1.2.4.4-1.2.8-1.4Z"
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleTower({ className, size = 36 }: DoodleProps) {
  return (
    <svg className={className} width={size * 0.55} height={size} viewBox="0 0 28 48" fill="none" aria-hidden>
      <path d="M10 44V18l4-8 4 8v26" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 24h12M9 32h10M10 38h8" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
      <circle cx="14" cy="8" r="2.5" stroke={stroke} strokeWidth="1.3" />
      <path d="M14 5.5V2" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function DoodlePassport({ className, size = 36 }: DoodleProps) {
  return (
    <svg className={className} width={size * 0.75} height={size} viewBox="0 0 36 48" fill="none" aria-hidden>
      <rect x="6" y="4" width="24" height="40" rx="3" stroke={stroke} strokeWidth="1.5" />
      <circle cx="18" cy="20" r="7" stroke={stroke} strokeWidth="1.3" opacity="0.75" />
      <ellipse cx="18" cy="20" rx="3" ry="7" stroke={stroke} strokeWidth="1" opacity="0.45" />
      <path d="M12 34h12M14 38h8" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/* ── Soft 3D product objects (SVG layers, FlightOne palette) ─── */

export function ObjectPlane({ className, size = 72 }: DoodleProps) {
  return (
    <svg
      className={`fo-object fo-object--plane ${className ?? ""}`}
      width={size}
      height={size * 0.55}
      viewBox="0 0 96 52"
      fill="none"
      aria-hidden
    >
      <ellipse cx="48" cy="46" rx="28" ry="4" fill="#0e1620" opacity="0.08" />
      <path
        d="M12 28c18-3 30-12 42-20l6-3 3 9-9 6c-6 12-15 21-27 27l-9 3 3-9 6-12Z"
        fill="#ffffff"
        stroke="#0896bf"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M54 11l12 9M66 20l9-3" stroke="#0e1620" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
      <path d="M20 32l14-4" stroke="#0896bf" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <circle cx="58" cy="18" r="2.2" fill="#0896bf" opacity="0.7" />
    </svg>
  );
}

export function ObjectGlobe({ className, size = 64 }: DoodleProps) {
  return (
    <svg
      className={`fo-object fo-object--globe ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden
    >
      <ellipse cx="36" cy="64" rx="18" ry="3.5" fill="#0e1620" opacity="0.08" />
      <circle cx="36" cy="34" r="24" fill="#e8f6fa" stroke="#0896bf" strokeWidth="1.5" />
      <ellipse cx="36" cy="34" rx="10" ry="24" stroke="#2a8fad" strokeWidth="1.1" opacity="0.45" />
      <path d="M14 34h44M16 22h40M16 46h40" stroke="#0896bf" strokeWidth="1" opacity="0.4" />
      <path
        d="M28 16c4 6 4 14 0 22M44 16c-4 6-4 14 0 22"
        stroke="#0e1620"
        strokeWidth="1"
        opacity="0.2"
      />
      <circle cx="48" cy="24" r="3" fill="#0896bf" opacity="0.35" />
    </svg>
  );
}

export function ObjectSuitcase({ className, size = 56 }: DoodleProps) {
  return (
    <svg
      className={`fo-object fo-object--suitcase ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <ellipse cx="32" cy="58" rx="16" ry="3" fill="#0e1620" opacity="0.08" />
      <rect x="12" y="22" width="40" height="30" rx="4" fill="#ffffff" stroke="#0e1620" strokeWidth="1.4" />
      <path d="M24 22v-5a8 8 0 0 1 16 0v5" stroke="#0896bf" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 36h40" stroke="#0896bf" strokeWidth="1.2" opacity="0.45" />
      <rect x="28" y="33" width="8" height="6" rx="1.5" fill="#e8f6fa" stroke="#0896bf" strokeWidth="1" />
      <path d="M18 44h10M18 48h6" stroke="#0e1620" strokeWidth="1.1" opacity="0.25" strokeLinecap="round" />
    </svg>
  );
}

export function ObjectPin({ className, size = 40 }: DoodleProps) {
  return (
    <svg
      className={`fo-object fo-object--pin ${className ?? ""}`}
      width={size}
      height={size * 1.25}
      viewBox="0 0 40 50"
      fill="none"
      aria-hidden
    >
      <ellipse cx="20" cy="46" rx="8" ry="2.5" fill="#0e1620" opacity="0.1" />
      <path
        d="M20 4c-7 0-12.5 5-12.5 11.5C7.5 25 20 42 20 42s12.5-17 12.5-26.5C32.5 9 27 4 20 4Z"
        fill="#ffffff"
        stroke="#0896bf"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="15" r="4.5" fill="#e8f6fa" stroke="#0e1620" strokeWidth="1.2" opacity="0.85" />
      <circle cx="20" cy="15" r="1.8" fill="#0896bf" />
    </svg>
  );
}

export function ObjectPassport({ className, size = 48 }: DoodleProps) {
  return (
    <svg
      className={`fo-object fo-object--passport ${className ?? ""}`}
      width={size * 0.72}
      height={size}
      viewBox="0 0 48 64"
      fill="none"
      aria-hidden
    >
      <ellipse cx="24" cy="60" rx="12" ry="2.5" fill="#0e1620" opacity="0.08" />
      <rect x="8" y="6" width="32" height="50" rx="4" fill="#0e1620" />
      <rect x="10" y="8" width="28" height="46" rx="3" fill="#14304a" />
      <circle cx="24" cy="28" r="9" stroke="#0896bf" strokeWidth="1.4" fill="#e8f6fa" opacity="0.95" />
      <ellipse cx="24" cy="28" rx="3.5" ry="9" stroke="#2a8fad" strokeWidth="1" opacity="0.55" />
      <path d="M16 44h16M18 49h12" stroke="#74c9dd" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/* ── Compositions ─────────────────────────────────────────────── */

/** Animated route for search loading — plane travels along dotted path */
export function LoadingRouteTrack({
  className,
  from,
  to,
}: {
  className?: string;
  from?: string;
  to?: string;
}) {
  if (!from || !to) return null;

  return (
    <div className={`fo-loading-route-wrap ${className ?? ""}`} aria-hidden>
      <span className="fo-loading-route__code">{from}</span>
      <svg
        className="fo-loading-route"
        viewBox="0 0 260 26"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="fo-loading-route__path"
          vectorEffect="non-scaling-stroke"
          d="M8 16 C 65 4, 115 22, 175 10 C 205 4, 235 8, 252 12"
        />
        <circle cx="8" cy="16" r="2.5" className="fo-loading-route__node" />
        <circle
          cx="252"
          cy="12"
          r="2.5"
          className="fo-loading-route__node fo-loading-route__node--end"
        />
        <g className="fo-loading-route__plane">
          <path
            d="M0 0c3.2-.45 5.8-2.1 8.4-4.2l1.3-.65.65 1.9-2.1 1.25c-1.25 2.3-3 4.2-5.1 5.45l-2.1.65.65-1.9 1.55-2.5Z"
            fill="currentColor"
          />
        </g>
      </svg>
      <span className="fo-loading-route__code">{to}</span>
    </div>
  );
}

/** Landing hero — quiet route motif framing the headline */
export function HeroScene({ className }: { className?: string }) {
  return (
    <div className={`fo-hero-scene ${className ?? ""}`} aria-hidden>
      <ObjectPlane className="fo-hero-scene__plane" size={72} />
      <svg className="fo-hero-scene__route" viewBox="0 0 220 100" fill="none">
        <path
          className="fo-doodle-route-path"
          d="M18 72 C 55 28, 95 88, 140 42 S 190 28, 205 40"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeDasharray="5 7"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="18" cy="72" r="3.5" fill="currentColor" opacity="0.35" />
        <circle cx="205" cy="40" r="3.5" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  );
}

/** Empty results illustration */
export function EmptyTravelScene({ className }: { className?: string }) {
  return (
    <div className={`fo-empty-scene ${className ?? ""}`} aria-hidden>
      <ObjectSuitcase className="fo-empty-scene__case fo-float fo-float--slow" size={52} />
      <ObjectPlane className="fo-empty-scene__plane fo-float" size={64} />
      <svg className="fo-empty-scene__route" viewBox="0 0 160 40" fill="none">
        <path
          className="fo-doodle-route-path"
          d="M8 28 C 40 8, 70 34, 100 16 S 140 12, 152 18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
        <circle cx="8" cy="28" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="152" cy="18" r="3" fill="currentColor" opacity="0.75" />
      </svg>
      <ObjectPin className="fo-empty-scene__pin fo-float fo-float--delay" size={28} />
    </div>
  );
}

/** Compact accent for results header */
export function ResultsHeaderScene({ className }: { className?: string }) {
  return (
    <div className={`fo-results-header-scene ${className ?? ""}`} aria-hidden>
      <svg className="fo-results-header-scene__route" viewBox="0 0 180 48" fill="none">
        <path
          className="fo-doodle-route-path"
          d="M10 34 C 45 10, 75 40, 110 18 S 155 12, 170 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
        <circle cx="10" cy="34" r="3" fill="currentColor" opacity="0.45" />
        <circle cx="170" cy="20" r="3" fill="currentColor" opacity="0.8" />
      </svg>
      <ObjectPlane className="fo-results-header-scene__plane fo-float fo-float--slow" size={52} />
      <ObjectPin className="fo-results-header-scene__pin fo-float fo-float--delay" size={22} />
    </div>
  );
}

/** Shared FlightOne route language: LHE ───── ✈ ───── DXB */
export function RouteMotif({
  from,
  to,
  className,
  size = "md",
  animated = true,
}: {
  from: string;
  to: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}) {
  return (
    <div
      className={`fo-route-motif fo-route-motif--${size}${animated ? " fo-route-motif--animated" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <span className="fo-route-motif__code">{from}</span>
      <span className="fo-route-motif__track">
        <span className="fo-route-motif__dot" />
        <span className="fo-route-motif__line" />
        <span className="fo-route-motif__plane">✈</span>
        <span className="fo-route-motif__line" />
        <span className="fo-route-motif__dot fo-route-motif__dot--end" />
      </span>
      <span className="fo-route-motif__code">{to}</span>
    </div>
  );
}

/** Thinking glyph — restrained pulse */
export function ThinkingGlyph({ className }: { className?: string }) {
  return (
    <span className={`fo-thinking-glyph ${className ?? ""}`} aria-hidden>
      <DoodlePlaneMini />
    </span>
  );
}

/** Full detail hero — soft 3D travel stage behind the route */
export function DetailScene({
  className,
  from,
  to,
}: {
  className?: string;
  from?: string;
  to?: string;
}) {
  return (
    <div className={`fo-detail-scene ${className ?? ""}`} aria-hidden>
      <div className="fo-detail-scene__glow" />
      <div className="fo-detail-scene__cloud fo-detail-scene__cloud--a" />
      <div className="fo-detail-scene__cloud fo-detail-scene__cloud--b" />
      <ObjectGlobe className="fo-detail-scene__globe fo-float fo-float--slow" size={92} />
      <ObjectPlane className="fo-detail-scene__plane fo-float" size={108} />
      <ObjectPin className="fo-detail-scene__pin fo-detail-scene__pin--from fo-float fo-float--delay" size={36} />
      <ObjectPin className="fo-detail-scene__pin fo-detail-scene__pin--to fo-float fo-float--delay2" size={36} />
      <ObjectSuitcase className="fo-detail-scene__case fo-float fo-float--slower" size={52} />
      <ObjectPassport className="fo-detail-scene__passport fo-float fo-float--delay" size={46} />
      <DoodleTicket className="fo-detail-scene__ticket fo-float fo-float--delay2" size={54} />
      <svg className="fo-detail-scene__arc" viewBox="0 0 320 120" fill="none">
        <path
          className="fo-doodle-route-path"
          d="M28 88 C 90 18, 150 18, 210 52 S 280 78, 292 70"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 8"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="28" cy="88" r="4.5" fill="currentColor" opacity="0.4" />
        <circle cx="292" cy="70" r="4.5" fill="currentColor" opacity="0.75" />
      </svg>
      {from ? <span className="fo-detail-scene__label fo-detail-scene__label--from">{from}</span> : null}
      {to ? <span className="fo-detail-scene__label fo-detail-scene__label--to">{to}</span> : null}
    </div>
  );
}

/** Compact motif cluster for the fare / boarding panel */
export function DetailFareMotif({ className }: { className?: string }) {
  return (
    <div className={`fo-detail-fare-motif ${className ?? ""}`} aria-hidden>
      <DoodleBoardingPass className="fo-detail-fare-motif__pass fo-float fo-float--slow" size={52} />
      <ObjectSuitcase className="fo-detail-fare-motif__case fo-float fo-float--delay" size={36} />
      <DoodleStamp className="fo-detail-fare-motif__stamp fo-float fo-float--delay2" size={34} />
    </div>
  );
}

/** Corner ambience objects for the detail page shell */
export function DetailAmbience({ className }: { className?: string }) {
  return (
    <div className={`fo-detail-ambience ${className ?? ""}`} aria-hidden>
      <ObjectGlobe className="fo-detail-ambience__globe fo-float fo-float--slower" size={120} />
      <ObjectPlane className="fo-detail-ambience__plane fo-float fo-float--slow" size={86} />
      <ObjectPin className="fo-detail-ambience__pin fo-float fo-float--delay" size={40} />
      <DoodleTower className="fo-detail-ambience__tower fo-float fo-float--delay2" size={48} />
      <ObjectSuitcase className="fo-detail-ambience__case fo-float" size={58} />
    </div>
  );
}
