# Hotel comps (SerpAPI Google Hotels)

**Audience:** engineers extending Ava’s comps pitch.  
**Status:** Hotels + flights shipped.

## Goal

### Stays
1. **Miss on Travelport** — Google Hotels comps → score → GDS search those names.
2. **Hit but OTA cheaper** — courtesy dream stay + cheaper bookable comps.
3. **Comp not on GDS** — indicative mention + WhatsApp; never invent card prices.

### Flights
1. **Preferred airline** — if competitive, lead with it; else courtesy + sharper bookable options.
2. **Nearby airports** — search metro alts (e.g. LHR↔LGW/STN) and pitch cheaper legs.
3. **Google Flights** — market lowest / preferred-carrier indicative intel for Ava’s narrative.

## Env

```bash
SERPAPI_API_KEY=...   # or SERP_API_KEY
```

Unset key → comps layer no-ops Serp calls; GDS alt-airport search still runs for flights.

## Code map

| Piece | Path |
|---|---|
| Hotels Serp | `lib/comps/serpHotels.ts` |
| Hotel scoring | `lib/comps/scoreHotelComps.ts` |
| Hotel resolve | `lib/comps/hotelComps.ts` |
| Flights Serp | `lib/comps/serpFlights.ts` |
| Alt airports | `lib/comps/altAirports.ts` |
| Flight resolve | `lib/comps/flightComps.ts` |
| Orchestrator | `retrieveOffers` / `retrieveFromPlan` / `enrichNamedHotelWithComps` |
| LLM context | `buildOfferContext` in `lib/consultant/prompt.ts` |
