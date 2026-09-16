import { describe, expect, it } from "vitest";
import { distanceKm, namesLikelySame, scoreHotelComps } from "./scoreHotelComps";
import type { SerpHotelProperty } from "./types";

const target: SerpHotelProperty = {
  name: "Burj Al Arab",
  stars: 5,
  rating: 4.8,
  reviews: 2000,
  priceMajor: 1000,
  currency: "USD",
  gps: { lat: 25.1412, lng: 55.1853 },
  brandHint: "jumeirah",
  yearBuilt: 1999,
  propertyToken: "t1",
};

function prop(partial: Partial<SerpHotelProperty> & { name: string }): SerpHotelProperty {
  return {
    stars: 5,
    rating: 4.5,
    reviews: 500,
    priceMajor: 700,
    currency: "USD",
    gps: { lat: 25.14, lng: 55.19 },
    brandHint: null,
    yearBuilt: 2015,
    propertyToken: null,
    ...partial,
  };
}

describe("scoreHotelComps", () => {
  it("ranks nearby same-star luxury above distant midscale", () => {
    const scored = scoreHotelComps(target, [
      prop({
        name: "Waldorf Astoria Dubai Palm Jumeirah",
        brandHint: "waldorf",
        gps: { lat: 25.13, lng: 55.12 },
        yearBuilt: 2013,
        priceMajor: 650,
      }),
      prop({
        name: "Budget Inn Marina",
        stars: 3,
        gps: { lat: 25.08, lng: 55.14 },
        priceMajor: 120,
      }),
    ]);
    expect(scored.some((s) => /waldorf/i.test(s.name))).toBe(true);
    expect(scored.every((s) => s.stars >= 4)).toBe(true);
  });

  it("excludes the same property name", () => {
    const scored = scoreHotelComps(target, [
      prop({ name: "Burj Al Arab Jumeirah" }),
      prop({ name: "Jumeirah Al Naseem", brandHint: "jumeirah" }),
    ]);
    expect(scored.every((s) => !namesLikelySame(s.name, "Burj Al Arab"))).toBe(true);
  });
});

describe("distanceKm", () => {
  it("is ~0 for same point", () => {
    expect(distanceKm({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBeLessThan(0.01);
  });
});
