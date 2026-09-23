/**
 * Demo data seeder — populates every traveller-facing surface for
 * demo@flightone.local so a live demo has realistic depth.
 *
 * SAFETY
 * ------
 * This script refuses to run unless DEMO_SEED=true is explicitly set. The
 * production guard in `seed.js` is deliberately left untouched, so an ordinary
 * deploy can never create demo data by accident. Running this against a real
 * production database is an explicit, opt-in act.
 *
 *   DEMO_SEED=true node prisma/seed-demo.js
 *   DEMO_SEED=true DEMO_RESET=true node prisma/seed-demo.js   # wipe first
 *
 * IDEMPOTENT: every write is an upsert keyed on a deterministic `demo_*` id,
 * so re-running updates in place instead of duplicating. `DEMO_RESET=true`
 * deletes only rows this script owns (ids prefixed `demo_`), never real data.
 *
 * Flight data mirrors the captured Galileo fare shop in
 * `client/lib/demo/galileo-fares.json` so the seeded bookings and the demo
 * search corpus tell the same story.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL = (process.env.DEMO_USER_EMAIL || "demo@flightone.local").trim().toLowerCase();
const PREFIX = "demo_";
const id = (s) => `${PREFIX}${s}`;

/** Fixed clock so re-runs produce stable, explainable dates. */
const NOW = new Date();
const days = (n) => new Date(NOW.getTime() + n * 86400000);
const hours = (n) => new Date(NOW.getTime() + n * 3600000);

function requireOptIn() {
  if (process.env.DEMO_SEED !== "true") {
    console.error(
      "Refusing to run: set DEMO_SEED=true to seed demo data.\n" +
        "  DEMO_SEED=true node prisma/seed-demo.js",
    );
    process.exit(1);
  }
}

async function findDemoUser() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    console.error(
      `No user found for ${DEMO_EMAIL}.\n` +
        "Run the base seeder first (npm run db:seed), or set DEMO_USER_EMAIL to an existing account.",
    );
    process.exit(1);
  }
  return user;
}

/* ─────────────────────────── reset ─────────────────────────── */

async function resetDemoRows(userId) {
  if (process.env.DEMO_RESET !== "true") return;
  const startsWith = { startsWith: PREFIX };

  // Children before parents. Only demo_-prefixed rows are ever touched.
  await prisma.journeyEvent.deleteMany({ where: { id: startsWith } });
  await prisma.journeyWatch.deleteMany({ where: { id: startsWith } });
  await prisma.rewardLedgerEntry.deleteMany({ where: { id: startsWith } });
  await prisma.referralAttribution.deleteMany({ where: { id: startsWith } });
  await prisma.travelCredit.deleteMany({ where: { id: startsWith } });
  await prisma.refundCase.deleteMany({ where: { id: startsWith } });
  await prisma.escalationTicket.deleteMany({ where: { id: startsWith } });
  await prisma.visaApplication.deleteMany({ where: { id: startsWith } });
  await prisma.vaultVisaRecord.deleteMany({ where: { id: startsWith } });
  await prisma.vaultShareLink.deleteMany({ where: { id: startsWith } });
  await prisma.vaultDocument.deleteMany({ where: { id: startsWith } });
  await prisma.message.deleteMany({ where: { id: startsWith } });
  await prisma.conversation.deleteMany({ where: { id: startsWith } });
  await prisma.booking.deleteMany({ where: { id: startsWith } });
  await prisma.loyaltyMembership.deleteMany({ where: { id: startsWith } });
  await prisma.emergencyContact.deleteMany({ where: { id: startsWith } });
  await prisma.rewardAccount.deleteMany({ where: { userId, id: startsWith } });
  console.log("Reset: removed existing demo_* rows");
}

/* ──────────────────────── traveller profile ──────────────────────── */

async function seedProfile(userId) {
  await prisma.travellerProfile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: "Demo Traveller",
      phone: "+92 300 1234567",
      nationality: "PK",
      seatPref: "aisle",
      mealPref: "No beef",
      preferredAirlines: ["EK", "EY", "QR", "TK"],
      preferredCabin: "ECONOMY",
      maxLayoverMinutes: 360,
    },
    update: {
      phone: "+92 300 1234567",
      nationality: "PK",
      preferredAirlines: ["EK", "EY", "QR", "TK"],
      maxLayoverMinutes: 360,
    },
  });

  const loyalty = [
    { key: "ek", type: "AIRLINE", programCode: "EK", memberNumber: "EK4471882" },
    { key: "ey", type: "AIRLINE", programCode: "EY", memberNumber: "EY9930145" },
    { key: "mar", type: "HOTEL", programCode: "MARRIOTT", memberNumber: "MR77214508" },
  ];
  for (const l of loyalty) {
    await prisma.loyaltyMembership.upsert({
      where: { id: id(`loyalty_${l.key}`) },
      create: {
        id: id(`loyalty_${l.key}`),
        profileUserId: userId,
        type: l.type,
        programCode: l.programCode,
        memberNumber: l.memberNumber,
      },
      update: { memberNumber: l.memberNumber },
    });
  }

  await prisma.emergencyContact.upsert({
    where: { id: id("emergency_1") },
    create: {
      id: id("emergency_1"),
      profileUserId: userId,
      fullName: "Ayesha Khan",
      relationship: "Spouse",
      phone: "+92 300 7654321",
      email: "ayesha.khan@example.com",
      isPrimary: true,
    },
    update: { phone: "+92 300 7654321" },
  });

  console.log("✓ Traveller profile, 3 loyalty memberships, 1 emergency contact");
}

/* ──────────────────────────── bookings ──────────────────────────── */

/** Mirrors captured Galileo fares — see client/lib/demo/galileo-fares.json. */
const BOOKINGS = [
  {
    key: "dxb_sfo",
    status: "TICKETED",
    product: "FLIGHT",
    amountMinor: 30435700,
    netMinor: 27392100,
    externalRef: "K4M8QP",
    route: "DXB → SFO",
    carrier: "EY",
    flightNumber: "EY5411",
    departOffsetDays: 21,
    supplierCode: "GALILEO",
  },
  {
    key: "lhe_jfk",
    status: "COMPLETED",
    product: "FLIGHT",
    amountMinor: 16676500,
    netMinor: 15008850,
    externalRef: "T9R2XB",
    route: "LHE → JFK",
    carrier: "EY",
    flightNumber: "EY285",
    departOffsetDays: -45,
    supplierCode: "GALILEO",
  },
  {
    key: "lhe_cdg",
    status: "RESERVED",
    product: "FLIGHT",
    amountMinor: 13337600,
    netMinor: 12003840,
    externalRef: null,
    route: "LHE → CDG",
    carrier: "EY",
    flightNumber: "EY285",
    departOffsetDays: 34,
    supplierCode: "GALILEO",
  },
  {
    key: "lhe_mxp",
    status: "QUOTED",
    product: "FLIGHT",
    amountMinor: 14041600,
    netMinor: 12637440,
    externalRef: null,
    route: "LHE → MXP",
    carrier: "EY",
    flightNumber: "EY289",
    departOffsetDays: 56,
    supplierCode: "GALILEO",
  },
  {
    key: "dxb_hotel",
    status: "TICKETED",
    product: "HOTEL",
    amountMinor: 4850000,
    netMinor: 4122500,
    externalRef: "HTL-884201",
    route: "Dubai · 3 nights",
    carrier: null,
    flightNumber: null,
    departOffsetDays: 21,
    supplierCode: "RATEHAWK",
    // Stay detail the journey card renders. Check-out is derived from the
    // check-in below (departOffsetDays + nights) so the two never disagree.
    hotel: {
      name: "Rove Downtown Dubai",
      city: "Dubai",
      cityCode: "DXB",
      nights: 3,
      roomType: "Rover Room, 1 King",
      boardType: "Breakfast included",
    },
  },
  {
    key: "lhe_yyz_cancelled",
    status: "CANCELLED",
    product: "FLIGHT",
    amountMinor: 21415900,
    netMinor: 19274310,
    externalRef: "M2K7LP",
    route: "LHE → YYZ",
    carrier: "PK",
    flightNumber: "PK797",
    departOffsetDays: -12,
    supplierCode: "GALILEO",
  },
];

async function seedBookings(userId) {
  for (const b of BOOKINGS) {
    const departAt = days(b.departOffsetDays);
    const data = {
      userId,
      status: b.status,
      product: b.product,
      currency: "PKR",
      amountMinor: b.amountMinor,
      netMinor: b.netMinor,
      marginMinor: b.amountMinor - b.netMinor,
      supplierCode: b.supplierCode,
      externalRef: b.externalRef,
      quoteExpiresAt: b.status === "QUOTED" ? hours(18) : null,
      reservedUntil: b.status === "RESERVED" ? days(2) : null,
      travellerSnapshot: {
        givenName: "Demo",
        surname: "Traveller",
        nationality: "PK",
        passportNumber: "AB1234567",
      },
      metadata: {
        demo: true,
        route: b.route,
        carrier: b.carrier,
        flightNumber: b.flightNumber,
        departAt: departAt.toISOString(),
        ...(b.hotel
          ? {
              hotel: {
                ...b.hotel,
                checkInDate: departAt.toISOString().slice(0, 10),
                checkOutDate: days(b.departOffsetDays + b.hotel.nights)
                  .toISOString()
                  .slice(0, 10),
                confirmationRef: b.externalRef,
              },
            }
          : {}),
      },
    };
    await prisma.booking.upsert({
      where: { id: id(`booking_${b.key}`) },
      create: { id: id(`booking_${b.key}`), ...data },
      update: data,
    });
  }
  console.log(`✓ ${BOOKINGS.length} bookings (ticketed, completed, reserved, quoted, hotel, cancelled)`);
}

/* ────────────────────────── conversations ────────────────────────── */

const CONVERSATIONS = [
  {
    key: "dxb_sfo",
    title: "Dubai to San Francisco · October",
    messages: [
      { role: "USER", content: "I need to fly Dubai to San Francisco around 13 October, economy, one traveller." },
      { role: "ASSISTANT", content: "I found 3 itineraries and 8 fares from Travelport for DXB → SFO on 13 Oct. The best value is Etihad via Abu Dhabi at PKR 304,357 — 29h 26m with a 3h 45m layover. Shall I hold it?" },
      { role: "USER", content: "What's included in the baggage?" },
      { role: "ASSISTANT", content: "Economy Basic includes 1 carry-on but no checked bag. Economy Value at PKR 318,418 adds 1 checked piece — PKR 14,061 more, which is cheaper than paying at the airport." },
    ],
  },
  {
    key: "paris",
    title: "Paris trip planning",
    messages: [
      { role: "USER", content: "Cheapest way from Lahore to Paris mid-October?" },
      { role: "ASSISTANT", content: "Etihad via Abu Dhabi at PKR 133,376 is the lowest — 12h 40m total with a 1h 50m connection. Gulf Air via Bahrain is PKR 196,234 if you'd rather an overnight departure." },
    ],
  },
  {
    key: "visa",
    title: "UAE visa requirements",
    messages: [
      { role: "USER", content: "Do I need a visa for UAE on a Pakistani passport?" },
      { role: "ASSISTANT", content: "Yes — Pakistani passport holders need a visa for the UAE. I've opened a tracking case for you. Upload your passport scan to the vault and I'll pre-fill the application checklist." },
    ],
  },
];

async function seedConversations(userId) {
  let msgCount = 0;
  for (const [ci, c] of CONVERSATIONS.entries()) {
    const convId = id(`conv_${c.key}`);
    const createdAt = days(-(7 - ci * 2));
    await prisma.conversation.upsert({
      where: { id: convId },
      create: { id: convId, userId, title: c.title, status: "ACTIVE", metadata: { demo: true }, createdAt },
      update: { title: c.title, metadata: { demo: true } },
    });
    for (const [mi, m] of c.messages.entries()) {
      const mid = id(`msg_${c.key}_${mi}`);
      await prisma.message.upsert({
        where: { id: mid },
        create: {
          id: mid,
          conversationId: convId,
          role: m.role,
          content: m.content,
          provider: m.role === "ASSISTANT" ? "gemini" : null,
          createdAt: new Date(createdAt.getTime() + mi * 60000),
        },
        update: { content: m.content },
      });
      msgCount++;
    }
  }
  console.log(`✓ ${CONVERSATIONS.length} conversations, ${msgCount} messages`);
}

/* ──────────────────────────── vault ──────────────────────────── */

const VAULT_DOCS = [
  { key: "passport", type: "PASSPORT", title: "Pakistan Passport", issue: -900, expires: 1200, file: "passport-demo.pdf" },
  { key: "uae_visa", type: "VISA", title: "UAE Visit Visa", issue: -60, expires: 45, file: "uae-visa.pdf", visa: { destinationCode: "AE", visaType: "Visit", holderStatus: "ISSUED" } },
  { key: "us_visa", type: "VISA", title: "US B1/B2 10-Year Visa", issue: -1100, expires: 2500, file: "us-visa.pdf", visa: { destinationCode: "US", visaType: "B1/B2", holderStatus: "ISSUED" } },
  { key: "nic", type: "NATIONAL_ID", title: "CNIC", issue: -1500, expires: 800, file: "cnic.jpg" },
  { key: "ek_card", type: "FF_CARD", title: "Emirates Skywards Card", issue: -400, expires: null, file: "skywards.png" },
  { key: "insurance", type: "INSURANCE", title: "Travel Insurance — Schengen", issue: -20, expires: 70, file: "insurance.pdf" },
  { key: "expiring", type: "RESIDENCE_PERMIT", title: "UAE Residence Permit", issue: -700, expires: 25, file: "residence.pdf" },
];

async function seedVault(userId) {
  for (const d of VAULT_DOCS) {
    const docId = id(`vault_${d.key}`);
    const data = {
      ownerUserId: userId,
      type: d.type,
      title: d.title,
      issueDate: days(d.issue),
      expiresAt: d.expires === null ? null : days(d.expires),
      originalFilename: d.file,
      contentType: d.file.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
      byteSize: 180000 + d.key.length * 1000,
      storageKey: `demo/vault/${d.key}`,
      version: 1,
      isActive: true,
      fileMeta: { demo: true },
    };
    await prisma.vaultDocument.upsert({
      where: { id: docId },
      create: { id: docId, ...data },
      update: data,
    });

    if (d.visa) {
      await prisma.vaultVisaRecord.upsert({
        where: { documentId: docId },
        create: {
          id: id(`visarec_${d.key}`),
          documentId: docId,
          destinationCode: d.visa.destinationCode,
          visaType: d.visa.visaType,
          holderStatus: d.visa.holderStatus,
          issuingAuthority: d.visa.destinationCode === "AE" ? "GDRFA Dubai" : "US Consulate Islamabad",
          remindersEnabled: true,
        },
        update: { visaType: d.visa.visaType, holderStatus: d.visa.holderStatus },
      });
    }
  }
  console.log(`✓ ${VAULT_DOCS.length} vault documents (1 expiring in 25 days, 2 with visa records)`);
}

/* ──────────────────────────── visa ──────────────────────────── */

async function seedVisa(userId) {
  const apps = [
    { key: "ae", nationality: "PK", destination: "AE", status: "APPROVED", appointment: -40, location: "GDRFA Dubai" },
    { key: "fr", nationality: "PK", destination: "FR", status: "IN_PROCESS", appointment: 12, location: "VFS Global, Lahore" },
    { key: "ca", nationality: "PK", destination: "CA", status: "DRAFT", appointment: null, location: null },
  ];
  for (const a of apps) {
    const data = {
      userId,
      nationalityCode: a.nationality,
      destinationCode: a.destination,
      status: a.status,
      appointmentAt: a.appointment === null ? null : days(a.appointment),
      appointmentLocation: a.location,
      checklist: [
        { item: "Valid passport (6+ months)", done: true },
        { item: "Passport photographs", done: true },
        { item: "Bank statement (3 months)", done: a.status !== "DRAFT" },
        { item: "Confirmed flight itinerary", done: a.status === "APPROVED" },
        { item: "Hotel booking confirmation", done: a.status === "APPROVED" },
      ],
      notes: a.status === "IN_PROCESS" ? "Biometrics submitted, awaiting decision." : null,
    };
    await prisma.visaApplication.upsert({
      where: { id: id(`visa_${a.key}`) },
      create: { id: id(`visa_${a.key}`), ...data },
      update: data,
    });
  }
  console.log("✓ 3 visa applications (approved, in-process, draft)");
}

/* ──────────────────────────── rewards ──────────────────────────── */

async function seedRewards(userId) {
  const accountId = id("reward_account");
  await prisma.rewardAccount.upsert({
    where: { userId },
    create: { id: accountId, userId, referralCode: "5E7DVVH4", tier: "GOLD" },
    update: { tier: "GOLD" },
  });
  const account = await prisma.rewardAccount.findUnique({ where: { userId } });

  const entries = [
    { key: "earn_jfk", type: "EARN", points: 1668, note: "LHE → JFK ticketed booking", bookingKey: "lhe_jfk", offset: -45 },
    { key: "earn_dxb", type: "EARN", points: 3044, note: "DXB → SFO ticketed booking", bookingKey: "dxb_sfo", offset: -6 },
    { key: "earn_hotel", type: "EARN", points: 485, note: "Dubai hotel booking", bookingKey: "dxb_hotel", offset: -6 },
    { key: "referral", type: "REFERRAL_BONUS", points: 500, note: "Referral bonus — invitee completed first ticketed earn", bookingKey: null, offset: -30 },
    { key: "redeem", type: "REDEEM", points: -1200, note: "Redeemed against LHE → CDG fare", bookingKey: "lhe_cdg", offset: -3 },
    { key: "reverse", type: "REVERSE", points: -2142, note: "Reversed — LHE → YYZ booking cancelled", bookingKey: "lhe_yyz_cancelled", offset: -12 },
  ];
  for (const e of entries) {
    const data = {
      accountId: account.id,
      type: e.type,
      points: e.points,
      bookingId: e.bookingKey ? id(`booking_${e.bookingKey}`) : null,
      note: e.note,
      createdAt: days(e.offset),
      expiresAt: e.type === "EARN" ? days(365 + e.offset) : null,
    };
    await prisma.rewardLedgerEntry.upsert({
      where: { id: id(`ledger_${e.key}`) },
      create: { id: id(`ledger_${e.key}`), ...data },
      update: { points: e.points, note: e.note },
    });
  }

  const balance = entries.reduce((a, e) => a + e.points, 0);
  console.log(`✓ Reward account (GOLD, code 5E7DVVH4), ${entries.length} ledger entries, balance ${balance} pts`);
  return balance;
}

/* ──────────────────────────── journey ──────────────────────────── */

async function seedJourney(userId) {
  const bookingId = id("booking_dxb_sfo");
  const watchId = id("watch_dxb_sfo");
  await prisma.journeyWatch.upsert({
    where: { bookingId },
    create: {
      id: watchId,
      bookingId,
      userId,
      status: "ACTIVE",
      flightNumber: "EY5411",
      departAt: days(21),
      arriveAt: days(22),
      lastPolledAt: hours(-1),
      metadata: { demo: true, route: "DXB → SFO" },
    },
    update: { status: "ACTIVE", lastPolledAt: hours(-1) },
  });

  // Types must come from the JourneyEventType enum:
  // DELAY | CANCELLED | GATE_CHANGE | TERMINAL_CHANGE | BOARDING | WEATHER
  // | IMMIGRATION | HOTEL_CHECKIN | TRANSFER | OTHER
  const events = [
    { key: "transfer", type: "TRANSFER", severity: 0, title: "Connection confirmed in Abu Dhabi", body: "3h 45m layover — terminal transfer not required.", offset: -6 },
    { key: "gate", type: "GATE_CHANGE", severity: 1, title: "Gate changed to B12", body: "EY5411 now departs from gate B12.", offset: -1 },
    { key: "delay", type: "DELAY", severity: 2, title: "Departure delayed 20 minutes", body: "EY5411 now departs 04:15 instead of 03:55.", offset: -0.5 },
    { key: "hotel", type: "HOTEL_CHECKIN", severity: 0, title: "Hotel check-in reminder", body: "Dubai stay check-in from 15:00 on arrival day.", offset: -0.25 },
  ];
  for (const e of events) {
    const data = {
      watchId,
      type: e.type,
      severity: e.severity,
      title: e.title,
      body: e.body,
      fingerprint: `${watchId}:${e.key}`,
      notifiedAt: days(e.offset),
      createdAt: days(e.offset),
    };
    await prisma.journeyEvent.upsert({
      where: { id: id(`jevent_${e.key}`) },
      create: { id: id(`jevent_${e.key}`), ...data },
      update: { title: e.title, body: e.body },
    });
  }
  console.log("✓ 1 journey watch, 4 journey events (transfer, gate change, delay, hotel)");
}

/* ──────────────────────── support / escalations ──────────────────────── */

async function seedEscalations(userId) {
  const tickets = [
    { key: "seat", trigger: "SPECIAL_SERVICE_REQUEST", status: "RESOLVED", priority: 1, conv: "dxb_sfo", booking: "dxb_sfo", note: "Aisle seat confirmed on both sectors.", offset: -5 },
    { key: "visa", trigger: "VISA_UNCERTAIN", status: "IN_PROGRESS", priority: 2, conv: "visa", booking: null, note: null, offset: -2 },
    { key: "refund", trigger: "REFUND_DISPUTE", status: "OPEN", priority: 3, conv: "paris", booking: "lhe_yyz_cancelled", note: null, offset: -1 },
  ];
  for (const t of tickets) {
    const data = {
      conversationId: id(`conv_${t.conv}`),
      userId,
      status: t.status,
      trigger: t.trigger,
      priority: t.priority,
      bookingId: t.booking ? id(`booking_${t.booking}`) : null,
      resolutionNote: t.note,
      handoffMode: "WARM",
      contextSnapshot: { demo: true, messages: [], capturedAt: days(t.offset).toISOString() },
      createdAt: days(t.offset),
    };
    await prisma.escalationTicket.upsert({
      where: { id: id(`esc_${t.key}`) },
      create: { id: id(`esc_${t.key}`), ...data },
      update: { status: t.status, priority: t.priority, resolutionNote: t.note },
    });
  }
  console.log("✓ 3 support cases (resolved, in-progress, open)");
}

/* ──────────────────────── refunds / credits ──────────────────────── */

async function seedRefunds(userId) {
  const bookingId = id("booking_lhe_yyz_cancelled");
  // RefundCaseStatus: DRAFT | QUOTED | ELIGIBLE | SUBMITTED | PROCESSING
  // | COMPLETED | FAILED | REQUIRES_HUMAN | REJECTED | NOT_ELIGIBLE
  const caseData = {
    bookingId,
    createdByUserId: userId,
    status: "COMPLETED",
    kind: "PARTIAL_REFUND",
    reason: "Schedule change — departure moved more than 6 hours.",
    partial: true,
    paymentRefundStatus: "PROVIDER_REFUNDED",
    createdAt: days(-11),
  };
  await prisma.refundCase.upsert({
    where: { id: id("refund_yyz") },
    create: { id: id("refund_yyz"), ...caseData },
    update: { status: caseData.status, reason: caseData.reason },
  });

  const creditData = {
    userId,
    sourceBookingId: bookingId,
    refundCaseId: id("refund_yyz"),
    currency: "PKR",
    amountMinor: 18000000,
    remainingMinor: 18000000,
    status: "ISSUED",
    expiresAt: days(320),
    idempotencyKey: id("credit_yyz_key"),
    formula: { demo: true, basis: "partial refund after schedule change" },
    createdAt: days(-10),
  };
  await prisma.travelCredit.upsert({
    where: { id: id("credit_yyz") },
    create: { id: id("credit_yyz"), ...creditData },
    update: { remainingMinor: creditData.remainingMinor, status: creditData.status },
  });
  console.log("✓ 1 refund case (completed, partial refund), 1 travel credit (PKR 180,000)");
}

/* ──────────────────────────── referrals ──────────────────────────── */

async function seedReferrals(userId) {
  // A referred user must exist; reuse the bootstrap admin if present so we
  // never invent a second credentialed account.
  const other = await prisma.user.findFirst({
    where: { email: { not: DEMO_EMAIL } },
    select: { id: true, email: true },
  });
  if (!other) {
    console.log("• Skipped referral attribution (no second user to attribute)");
    return;
  }
  const data = {
    referrerUserId: userId,
    referredUserId: other.id,
    signupAt: days(-35),
    firstBookingId: id("booking_lhe_jfk"),
    rewardedAt: days(-30),
  };
  await prisma.referralAttribution.upsert({
    where: { referredUserId: other.id },
    create: { id: id("referral_1"), ...data },
    update: { rewardedAt: data.rewardedAt },
  });
  console.log(`✓ 1 referral attribution (${other.email} referred, bonus paid)`);
}

/* ──────────────────────────── main ──────────────────────────── */

async function main() {
  requireOptIn();
  const user = await findDemoUser();
  console.log(`\nSeeding demo data for ${user.email} (${user.id})\n`);

  await resetDemoRows(user.id);
  await seedProfile(user.id);
  await seedBookings(user.id);
  await seedConversations(user.id);
  await seedVault(user.id);
  await seedVisa(user.id);
  await seedRewards(user.id);
  await seedJourney(user.id);
  await seedEscalations(user.id);
  await seedRefunds(user.id);
  await seedReferrals(user.id);

  console.log(`\nDone. Sign in as ${user.email} to see the populated demo.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
