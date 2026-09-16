import type { Gps, ScoredHotelComp, SerpHotelProperty } from "./types";

const LUXURY_BRANDS = new Set([
  "jumeirah",
  "four seasons",
  "ritz-carlton",
  "ritz carlton",
  "st. regis",
  "st regis",
  "mandarin oriental",
  "rosewood",
  "waldorf",
  "bulgari",
  "arman",
  "raffles",
  "park hyatt",
  "edition",
  "address",
]);

function brandTier(brand: string | null, name: string): number {
  const b = (brand || "").toLowerCase();
  const n = name.toLowerCase();
  if ([...LUXURY_BRANDS].some((x) => b.includes(x) || n.includes(x))) return 1;
  if (
    /hilton|marriott|hyatt|fairmont|intercontinental|sofitel|sheraton|westin|autograph|luxury collection/.test(
      n,
    )
  ) {
    return 0.72;
  }
  return 0.45;
}

/** Haversine distance in km. */
export function distanceKm(a: Gps, b: Gps): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function namesLikelySame(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = nb.split(" ").filter((t) => t.length > 2);
  const overlap = tb.filter((t) => ta.has(t)).length;
  return overlap >= 2 && overlap / Math.max(tb.length, 1) >= 0.5;
}

/**
 * Score candidates vs a target hotel (stars, proximity, brand, reviews, newness).
 */
export function scoreHotelComps(
  target: SerpHotelProperty,
  candidates: SerpHotelProperty[],
  limit = 6,
): ScoredHotelComp[] {
  const scored: ScoredHotelComp[] = [];

  for (const c of candidates) {
    if (namesLikelySame(c.name, target.name)) continue;

    const reasons: string[] = [];
    let score = 0;

    const starDelta = Math.abs(c.stars - target.stars);
    if (starDelta === 0) {
      score += 32;
      reasons.push(`${c.stars}★ match`);
    } else if (starDelta === 1 && c.stars >= Math.min(4, target.stars - 1)) {
      score += 22;
      reasons.push(`${c.stars}★ near ${target.stars}★`);
    } else {
      continue; // too far in class for a true luxury comp
    }

    if (target.gps && c.gps) {
      const km = distanceKm(target.gps, c.gps);
      if (km <= 2) {
        score += 28;
        reasons.push("same pocket");
      } else if (km <= 5) {
        score += 20;
        reasons.push(`${km.toFixed(1)} km`);
      } else if (km <= 12) {
        score += 10;
        reasons.push(`${km.toFixed(1)} km`);
      } else {
        score += 2;
      }
    } else {
      score += 8;
    }

    const tier = brandTier(c.brandHint, c.name);
    score += tier * 20;
    if (tier >= 0.9) reasons.push("prestige brand");
    else if (c.brandHint) reasons.push(c.brandHint);

    if (c.rating != null) {
      if (c.rating >= 4.6) {
        score += 12;
        reasons.push(`${c.rating.toFixed(1)} guest score`);
      } else if (c.rating >= 4.2) {
        score += 7;
      } else if (c.rating >= 3.8) {
        score += 3;
      }
    }

    if (c.yearBuilt != null) {
      const age = new Date().getUTCFullYear() - c.yearBuilt;
      if (age <= 8) {
        score += 12;
        reasons.push(`opened ${c.yearBuilt}`);
      } else if (age <= 15) {
        score += 7;
      } else if (age <= 25) {
        score += 3;
      }
    } else {
      score += 4; // unknown — mild prior, don't punish
    }

    // Prefer comps that look cheaper on OTA when both priced.
    if (
      target.priceMajor != null &&
      c.priceMajor != null &&
      c.priceMajor < target.priceMajor * 0.95
    ) {
      score += 8;
      reasons.push("often sharper OTA rate");
    }

    scored.push({ ...c, score, reasons: reasons.slice(0, 3) });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
