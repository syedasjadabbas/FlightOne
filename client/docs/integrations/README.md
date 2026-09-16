# Supplier integrations

Research and implementation notes for external supplier APIs. Booking orchestration
never calls these SDKs directly — see [DEVELOPMENT_GUIDE.md §7](../DEVELOPMENT_GUIDE.md)
and Module 03.

| Supplier | Role | Doc | Status |
|---|---|---|---|
| Travelport TripServices (Galileo / 1G) | Flights search, book, ticket | [travelport-tripservices.md](./travelport-tripservices.md) | Flights Search live; book/ticket later |
| Travelport TripServices Stays | Hotels (SearchComplete v12) | [travelport-tripservices.md](./travelport-tripservices.md) | Search live via hotel adapter |
| TPConnects Iris | Aggregated NDC / LCC / multi-GDS air (candidate) | [tpconnects-iris.md](./tpconnects-iris.md) | Research only — commercial kit required |
| RateHawk | Hotels (planned alternate) | — | Stub fallback when Travelport unset |

**Server stub today:** `filght-one-server/modules/suppliers/galileo.adapter.js`  
**Module checklist:** [03-ai-booking-engine.md](../modules/03-ai-booking-engine.md)
