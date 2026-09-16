/**
 * Editorial marketplace imagery — destination and category photos for
 * carousel tiles. Illustrative only; not tied to live inventory rows.
 *
 * Photo IDs are verified against images.unsplash.com (200 OK).
 */

const UNSPLASH = "https://images.unsplash.com";

function photo(id: string, w = 640, h = 480): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

function placeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const PLACE_IMAGES: Record<string, string> = {
  dubai: photo("photo-1512453979798-5ea266f8880c"),
  "abu dhabi": photo("photo-1518684079-3c830dcef090"),
  sharjah: photo("photo-1580674285054-bed31e145f59"),
  istanbul: photo("photo-1524231757912-21bdaf780172"),
  ankara: photo("photo-1541432901042-2d8bd64b4a9b"),
  antalya: photo("photo-1506905925346-21bda4d32df4"),
  turkey: photo("photo-1524231757912-21bdaf780172"),
  bangkok: photo("photo-1508009603885-50cf7c579365"),
  phuket: photo("photo-1589394815804-964ed0be2eb5"),
  thailand: photo("photo-1508009603885-50cf7c579365"),
  "kuala lumpur": photo("photo-1596422846543-75c683640588"),
  malaysia: photo("photo-1596422846543-75c683640588"),
  singapore: photo("photo-1525629925445-daf268011ed6"),
  maldives: photo("photo-1514282401047-d79a71a590e8"),
  "sri lanka": photo("photo-1566296314736-6eaac1ca0f8d"),
  colombo: photo("photo-1566296314736-6eaac1ca0f8d"),
  morocco: photo("photo-1489749798305-4fea3ae63d43"),
  marrakech: photo("photo-1489749798305-4fea3ae63d43"),
  casablanca: photo("photo-1539020140153-e4951137c6f6"),
  egypt: photo("photo-1539650116574-75c0c6d73f6e"),
  cairo: photo("photo-1539650116574-75c0c6d73f6e"),
  lahore: photo("photo-1587474260584-136574528ed5"),
  karachi: photo("photo-1566439741380-152a2ff0af7d"),
  islamabad: photo("photo-1566439741380-152a2ff0af7d"),
  jeddah: photo("photo-1586724237569-f3d0c1dee8c6"),
  riyadh: photo("photo-1586724237569-f3d0c1dee8c6"),
  doha: photo("photo-1559592413-7cec4d0cae2b"),
  london: photo("photo-1513635269975-59663e0ac1d8"),
  paris: photo("photo-1502602898657-3e91760cbb34"),
  "new york": photo("photo-1496442226666-8d4d0e62e6e9"),
};

const DEFAULT_CITY = photo("photo-1488646953014-85cb44e25828");

const DRIVE_IMAGES: Record<string, string> = {
  compact: photo("photo-1549317661-bd32c8ce0db2", 640, 400),
  suv: photo("photo-1606664515524-ed2f786a0bd6", 640, 400),
  premium: photo("photo-1618843479313-40f8afb4b4d8", 640, 400),
};

const STAY_IMAGES: Record<string, string> = {
  hotels: photo("photo-1566073771259-6a8506099945"),
  luxury: photo("photo-1582719478250-c89cae4dc85b"),
  central: photo("photo-1520250497591-112f2f40a3f4"),
};

const HOTEL_OFFER = photo("photo-1566073771259-6a8506099945");

export function placeMarketplaceImage(placeName: string): string {
  const key = placeKey(placeName);
  if (PLACE_IMAGES[key]) return PLACE_IMAGES[key]!;

  for (const [name, url] of Object.entries(PLACE_IMAGES)) {
    if (key.includes(name) || name.includes(key)) return url;
  }

  return DEFAULT_CITY;
}

export function driveCategoryImage(categoryId: string): string {
  return DRIVE_IMAGES[categoryId] ?? DRIVE_IMAGES.compact!;
}

export function stayDiscoveryImage(cardId: string, city: string): string {
  if (cardId === "hotels") {
    const cityImg = placeMarketplaceImage(city);
    return cityImg !== DEFAULT_CITY ? cityImg : STAY_IMAGES.hotels!;
  }
  return STAY_IMAGES[cardId] ?? STAY_IMAGES.hotels!;
}

export function hotelOfferImage(city?: string): string {
  if (city) {
    const cityImg = placeMarketplaceImage(city);
    if (cityImg !== DEFAULT_CITY) return cityImg;
  }
  return HOTEL_OFFER;
}

export function marketplaceImageAlt(label: string, context: "place" | "car" | "stay"): string {
  switch (context) {
    case "car":
      return `${label} car rental`;
    case "stay":
      return `${label} stays`;
    default:
      return `${label} destination`;
  }
}
