"use client";

import { useEffect, useState } from "react";
import type { TravellerLocation } from "@/lib/geo/types";
import { isTravellerLocation } from "@/lib/geo/types";

const STORAGE_KEY = "fo.travellerLocation.v1";
const GEO_TIMEOUT_MS = 9000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function readCached(): TravellerLocation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isTravellerLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCached(loc: TravellerLocation) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore quota */
  }
}

function browserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: 15 * 60 * 1000,
    });
  });
}

async function resolveFromBrowser(): Promise<TravellerLocation> {
  const pos = await browserPosition();
  const { latitude, longitude } = pos.coords;
  const json = await fetchJson(
    `/api/geo/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
  );
  if (!isTravellerLocation(json)) throw new Error("bad_reverse_payload");
  return json;
}

async function resolveFromIp(): Promise<TravellerLocation> {
  const json = await fetchJson("/api/geo");
  if (!isTravellerLocation(json)) throw new Error("bad_ip_payload");
  return json;
}

/**
 * Browser GPS first, then IP/edge headers via /api/geo.
 * Caches for the tab session so we don't re-prompt every message.
 */
export function useTravellerLocation(): {
  location: TravellerLocation | null;
  ready: boolean;
  source: TravellerLocation["source"] | null;
} {
  const [location, setLocation] = useState<TravellerLocation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = readCached();
      if (cached && !cancelled) {
        setLocation(cached);
        setReady(true);
        return;
      }

      try {
        const fromBrowser = await resolveFromBrowser();
        if (cancelled) return;
        writeCached(fromBrowser);
        setLocation(fromBrowser);
      } catch {
        try {
          const fromIp = await resolveFromIp();
          if (cancelled) return;
          writeCached(fromIp);
          setLocation(fromIp);
        } catch {
          if (cancelled) return;
          const fallback = await resolveFromIp().catch(() => null);
          if (fallback) {
            writeCached(fallback);
            setLocation(fallback);
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, ready, source: location?.source ?? null };
}
