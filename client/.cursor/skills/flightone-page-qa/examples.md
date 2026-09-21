# FlightOne Page QA — Examples

## Invoke (chat)

```text
Run flightone-page-qa on /rewards — full
```

```text
Use the page QA skill on /vault and /journey (design already done — QA only)
```

```text
Ship /concierge with the same design→API→UX loop as profile
```

## Full run (agent behavior)

1. Load skill + checklist.
2. Inventory `client/app/rewards/**` + related `lib/api/*`.
3. P1 redesign against profile/vault patterns.
4. P2 fix skip/hydration/retry gaps.
5. P3 implement loading / auth / error / empty.
6. P4 lint clean.
7. P5 browser smoke if `localhost:3000` up.
8. P6 report.

## QA-only run

Skip visual redesign. Still do P0, P2, P3, P4, P5, P6. Only touch design if a state UI is missing or broken.

## Design-only run

P0 + P1 + lint. Explicitly list deferred API/UX gaps in the report Residual risk section.

## Multi-route

```text
flightone-page-qa: redesign + QA /ops and /escalations
```

Parent agent may spawn **one** frontend subagent with both routes + this skill pasted; parent owns smoke + final report. Do not let two agents edit `Button.tsx` / `SiteNav.tsx` in parallel.

## Pass report sample

```markdown
## Page QA — /vault

### Design
- Master stage, nav rail, hero, summary strip, rows, modals aligned to profile.

### API
- hooks audited: useGetVaultDocumentsQuery, useGetVaultCapabilityQuery, upload/delete mutations
- fixes: added skip on capability query; retry on list error

### UX states
- loading / auth / error / empty: pass

### Smoke
- auth redirect OK; empty CTA opens upload modal; lint clean

### Residual risk
- OCR path not exercised (no sample file)
```
