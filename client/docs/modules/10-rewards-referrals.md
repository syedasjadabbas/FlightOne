# Module 10 — Rewards & Referrals

**PRD Module 10** · Prefix: `RWD` · Phase: 2

## Objective (from PRD)

Booking rewards, redeemable credits, referral rewards, corporate reward programmes, and
tiered loyalty levels.

## Dependencies

- Module 03 (ticketed bookings earn; checkout applies credit)
- Module 05 / payments (credit reduces customer payable only)
- Module 06 (corporate programmes)
- NotificationOutbox

## Checklist

### Earning
- [x] Booking-based accrual on TICKETED/ACTIVE/COMPLETED only (idempotent)
- [x] Referral code + attach; bonus after referred user's first EARN
- [x] Tiered loyalty (configurable thresholds)
- [x] Corporate reward programmes (company ledger + admin config)

### Redemption
- [x] Checkout credit via `/rewards/checkout-credit` (payable offset; net unchanged)
- [x] Partial redemption supported (points capped to payable)
- [x] Reversal hooks on refund (earn + redeem restore)

### Ledger & integrity
- [x] Append-only ledger; balance = sum(points)
- [x] Configurable expiry worker
- [x] Self-referral / duplicate attribution guards

### Visibility
- [x] `/rewards` UI — balance, tier progress, history, referral
- [x] Ava grounding for reward questions

## Configurable policy (env)

- `REWARD_EARN_POINTS_PER_HUNDRED_MINOR` (default 1)
- `REWARD_REFERRAL_BONUS_POINTS` (default 500)
- `REWARD_POINT_VALUE_MINOR` (default 1)
- `REWARD_CREDIT_EXPIRY_DAYS` (default 365)
- `REWARD_TIER_SILVER_AT` / `GOLD_AT` / `PLATINUM_AT`

## Status

**MODULE 10 COMPLETE** for implementable PRD scope. Rates/thresholds are configuration,
not invented fixed commercial policy.
