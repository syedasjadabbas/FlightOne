/**
 * Traveller-facing itinerary detail for a journey card.
 *
 * The journey watch only stores monitoring fields (flight number, depart/arrive
 * instants), and `extractJourneyFieldsFromBooking` reads booking `metadata`.
 * But the flown sectors live on `booking.supplierBookingRefs.itinerary`
 * (persisted from the supplier snapshot) and multi-city legs on
 * `metadata.tripLegs` — neither was read, so a ticketed trip rendered as
 * "DEP → ARR" with blank times.
 *
 * Pure: never invents a value. Anything the booking does not carry is omitted.
 * Local airport times stay as the "HH:MM" strings the supplier returned — they
 * have no timezone, so converting them to an instant would shift them.
 */

function asObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asSegments(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map(asObj)
    .filter((s) => str(s.originCode) && str(s.destinationCode))
    .map((s) => ({
      carrier: str(s.carrier),
      flightNumber: str(s.flightNumber),
      originCode: str(s.originCode).toUpperCase(),
      destinationCode: str(s.destinationCode).toUpperCase(),
      departDate: str(s.departureDate),
      departTimeLocal: str(s.departTimeLocal),
      arriveDate: str(s.arrivalDate),
      arriveTimeLocal: str(s.arriveTimeLocal),
      durationMinutes: num(s.durationMinutes),
      layoverMinutesAfter: num(s.layoverMinutesAfter),
      aircraft: str(s.aircraft),
    }));
}

/** One bookable flight leg (a bound), built from its sectors. */
function flightLeg({ label, segments, cabin, fallback = {} }) {
  const first = segments[0] ?? {};
  const last = segments[segments.length - 1] ?? {};
  const flown = segments.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const layovers = segments.reduce((sum, s, i) =>
    i < segments.length - 1 ? sum + (s.layoverMinutesAfter ?? 0) : sum, 0);
  const total = num(fallback.durationMinutes) ?? (flown > 0 ? flown + layovers : null);

  return {
    kind: "FLIGHT",
    label,
    flightNumber: first.flightNumber ?? str(fallback.flightNumber),
    carrier: first.carrier ?? str(fallback.carrier),
    origin: first.originCode ?? str(fallback.origin)?.toUpperCase() ?? null,
    destination: last.destinationCode ?? str(fallback.destination)?.toUpperCase() ?? null,
    departDate: first.departDate ?? str(fallback.departureDate),
    // Leg-level times (multi-city `tripLegs`) when no sectors were persisted.
    departTimeLocal: first.departTimeLocal ?? str(fallback.departTimeLocal),
    arriveDate: last.arriveDate ?? null,
    arriveTimeLocal: last.arriveTimeLocal ?? str(fallback.arriveTimeLocal),
    durationMinutes: total,
    stops: segments.length > 0 ? segments.length - 1 : num(fallback.stops),
    cabin: str(cabin) ?? str(fallback.cabin),
    segments,
  };
}

/** Parse "LHE-LHR" / "LHE → YYZ" into [origin, destination]. */
function routePair(route) {
  const parts = (str(route) ?? "")
    .split(/\s*(?:→|->|-|–)\s*/)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z]{3}$/.test(p));
  return parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : [null, null];
}

/** Hotel stay from `metadata.hotel`, falling back to the booking's own route text. */
function hotelStay(meta, booking, fields) {
  const hotel = asObj(meta.hotel);
  const checkInDate = str(hotel.checkInDate) ?? str(fields.checkInDate) ?? str(meta.departAt);
  const checkOutDate = str(hotel.checkOutDate) ?? str(fields.checkOutDate);
  // "Dubai · 3 nights" — the seeded/legacy shape; only read, never guessed.
  const routeText = str(meta.route);
  const nightsFromRoute = routeText?.match(/(\d+)\s*nights?/i)?.[1];
  let nights = num(hotel.nights) ?? (nightsFromRoute ? Number(nightsFromRoute) : null);
  if (nights == null && checkInDate && checkOutDate) {
    const diff = (Date.parse(checkOutDate) - Date.parse(checkInDate)) / 86_400_000;
    if (Number.isFinite(diff) && diff > 0) nights = Math.round(diff);
  }
  const city = str(hotel.city) ?? str(routeText?.split("·")[0]);

  return {
    kind: "HOTEL",
    hotelName: str(hotel.name),
    city,
    cityCode: str(hotel.cityCode) ?? fields.destination ?? null,
    checkInDate,
    checkOutDate,
    nights,
    roomType: str(hotel.roomType),
    boardType: str(hotel.boardType),
    confirmationRef: str(hotel.confirmationRef) ?? fields.confirmationRef ?? booking?.externalRef ?? null,
  };
}

/**
 * Ordered itinerary items for the card. Multi-city → one FLIGHT item per leg;
 * round trip → outbound + return; hotel → a HOTEL stay; transfers pass through.
 */
export function buildJourneyItinerary({ watch, booking, fields = {}, meta = {} }) {
  const bMeta = asObj(booking?.metadata);
  const refs = asObj(booking?.supplierBookingRefs);
  const itin = asObj(refs.itinerary);
  const cabin = str(itin.cabin) ?? str(asObj(asObj(bMeta.pricing).input).cabin);
  const outbound = asSegments(itin.segments);
  const inbound = asSegments(itin.returnSegments);
  const tripLegs = Array.isArray(bMeta.tripLegs) ? bMeta.tripLegs.map(asObj) : [];
  const items = [];

  if (tripLegs.length > 1) {
    // Only the first leg's sectors are persisted (the booking is anchored to
    // its snapshot) — attach them where they match, never to other legs.
    tripLegs.forEach((leg, i) => {
      const own = asSegments(leg.segments);
      const matches =
        i === 0 && outbound.length > 0 && outbound[0].originCode === str(leg.originCode)?.toUpperCase();
      items.push(
        flightLeg({
          label: `Flight ${i + 1} of ${tripLegs.length}`,
          segments: own.length > 0 ? own : matches ? outbound : [],
          cabin: str(leg.cabin) ?? cabin,
          fallback: {
            origin: leg.originCode,
            destination: leg.destinationCode,
            departureDate: leg.departureDate,
            flightNumber: leg.flightNumber,
            carrier: leg.airlineCode,
            departTimeLocal: leg.departTimeLocal,
            arriveTimeLocal: leg.arriveTimeLocal,
            durationMinutes: leg.durationMinutes,
            stops: leg.stops,
          },
        }),
      );
    });
  } else if (outbound.length > 0 || booking?.product === "FLIGHT" || watch?.flightNumber) {
    const [routeO, routeD] = routePair(bMeta.route ?? asObj(asObj(bMeta.pricing).input).route);
    items.push(
      flightLeg({
        label: inbound.length > 0 ? "Outbound" : null,
        segments: outbound,
        cabin,
        fallback: {
          origin: fields.origin ?? itin.origin ?? routeO,
          destination:
            // For a round trip the itinerary destination is the far end.
            fields.destination ?? (inbound.length ? null : itin.destination) ?? routeD,
          departureDate: itin.departureDate,
          flightNumber: watch?.flightNumber ?? fields.flightNumber ?? bMeta.flightNumber,
          carrier: itin.carrier ?? bMeta.carrier,
          durationMinutes: inbound.length ? null : itin.durationMinutes,
          stops: itin.stops,
        },
      }),
    );
    if (inbound.length > 0) {
      items.push(flightLeg({ label: "Return", segments: inbound, cabin }));
    }
  }

  if (booking?.product === "HOTEL" || fields.checkInDate || str(asObj(bMeta.hotel).name)) {
    items.push(hotelStay(bMeta, booking, fields));
  }

  if (fields.transferRef || fields.transferPickupAt) {
    items.push({
      kind: "TRANSFER",
      transferRef: fields.transferRef || null,
      pickupAt: fields.transferPickupAt || null,
    });
  }
  return items;
}

/** Card header facts: what kind of trip, which stops, what was paid. */
export function buildJourneySummary({ booking, itinerary }) {
  const flights = itinerary.filter((i) => i.kind === "FLIGHT");
  const hotel = itinerary.find((i) => i.kind === "HOTEL") ?? null;
  const bMeta = asObj(booking?.metadata);

  let tripType = "one_way";
  if (flights.length === 0) tripType = hotel ? "stay" : "unknown";
  else if (Array.isArray(bMeta.tripLegs) && bMeta.tripLegs.length > 1) tripType = "multi_city";
  else if (flights.some((f) => f.label === "Return")) tripType = "round_trip";

  const stops = [];
  for (const f of flights) {
    if (f.origin && stops[stops.length - 1] !== f.origin) stops.push(f.origin);
    if (f.destination) stops.push(f.destination);
  }

  return {
    product: booking?.product ?? null,
    tripType,
    stops,
    flightCount: flights.length,
    cabin: flights.find((f) => f.cabin)?.cabin ?? null,
    carrier: flights.find((f) => f.carrier)?.carrier ?? null,
    firstDepartDate: flights[0]?.departDate ?? hotel?.checkInDate ?? null,
    firstDepartTimeLocal: flights[0]?.departTimeLocal ?? null,
    lastArriveDate: flights[flights.length - 1]?.arriveDate ?? hotel?.checkOutDate ?? null,
    lastArriveTimeLocal: flights[flights.length - 1]?.arriveTimeLocal ?? null,
    amountMinor: num(booking?.amountMinor),
    currency: str(booking?.currency),
    supplierCode: str(booking?.supplierCode),
  };
}
