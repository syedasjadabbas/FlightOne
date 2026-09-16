# Module 16 — AI Knowledge Platform

Internal FlightOne knowledge for Ava grounding (SOPs, policies, contracts, visa procedures).
Not Traveller Vault. Not live booking/pricing/refund/visa eligibility.

## Categories (PRD)
SOP, AIRLINE_POLICY, SUPPLIER_RULE, CORPORATE_TRAVEL_POLICY, VISA_RULE,
SUPPLIER_CONTRACT, VISA_PROCEDURE, CORPORATE_AGREEMENT, TRAVEL_POLICY

## Lifecycle
DRAFT → PUBLISHED → ARCHIVED | EXPIRED  
Only PUBLISHED + currently valid (effective/expiry) + READY ingestion is retrieved.

## Visibility
- CUSTOMER_SAFE — may cite to customers
- INTERNAL — Ava may summarize; do not dump source to customers
- RESTRICTED — ops only; never returned to ordinary customers

## Retrieval
Deterministic keyword/term-overlap over Postgres (`keyword_overlap`). Not vector/embeddings.

## API
`/api/v1/knowledge` — documents CRUD/version/publish/archive, retrieve, ava-guidance

## UI
`/ops/knowledge` — requires knowledge:read|write or ops:dashboard:read

## Permissions
`knowledge:write`, `knowledge:read`, `ops:dashboard:read`
